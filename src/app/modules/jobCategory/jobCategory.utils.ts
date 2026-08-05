// Tree and breadcrumb utilities live here — not in service —
// because they are pure data-transformation functions with no
// business rules or DB calls. Keeps the service layer clean.

import { JobCategory } from './jobCategory.models';
import {
  IBreadcrumbItem,
  ICategoryTreeNode,
  IJobCategoryDocument,
} from './jobCategory.interface';

// ─────────────────────────────────────────────────────────────
// Build full category tree from flat array
// ─────────────────────────────────────────────────────────────
// Algorithm:
//   1. Fetch ALL categories in one query (avoids N+1)
//   2. Build an id → node map
//   3. Walk the flat array once — push each node into its parent's children[]
//   4. Collect nodes with no parent into the root array
//
// Time: O(n), Space: O(n) — efficient for typical category counts (<500)

export const buildCategoryTree = (
  categories: IJobCategoryDocument[],
): ICategoryTreeNode[] => {
  const map: Record<string, ICategoryTreeNode> = {};

  // Pass 1 — populate the map
  categories.forEach((cat) => {
    map[(cat._id as string).toString()] = {
      ...(cat.toObject ? cat.toObject() : cat),
      children: [],
    } as ICategoryTreeNode;
  });

  const roots: ICategoryTreeNode[] = [];

  // Pass 2 — wire parent → child relationships
  categories.forEach((cat) => {
    const node = map[(cat._id as string).toString()];
    if (cat.parentId) {
      const parentNode = map[cat.parentId.toString()];
      if (parentNode) {
        parentNode.children.push(node);
      }
    } else {
      // No parentId → root node
      roots.push(node);
    }
  });

  return roots;
};

// ─────────────────────────────────────────────────────────────
// Build breadcrumb for a given category
// ─────────────────────────────────────────────────────────────
// Traverses up the tree following parentId links until root.
// Result: [{ Technology }, { Frontend }, { React }]
//
// Worst case: MAX_CATEGORY_DEPTH (3) DB queries — acceptable
// Could be optimized with a materialized path pattern if depth grows

export const buildBreadcrumb = async (
  categoryId: string,
): Promise<IBreadcrumbItem[]> => {
  const breadcrumb: IBreadcrumbItem[] = [];
  let currentId: string | null = categoryId;

  while (currentId) {
    const category: Pick<IJobCategoryDocument, '_id' | 'name' | 'slug' | 'parentId'> | null =
      await JobCategory.findById(currentId)
        .select('_id name slug parentId')
        .lean();

    if (!category) break;

    // Prepend so result is root → leaf order
    breadcrumb.unshift({
      _id:  (category._id as any).toString(),
      name: category.name,
      slug: category.slug,
    });

    currentId = category.parentId ? category.parentId.toString() : null;
  }

  return breadcrumb;
};

// ─────────────────────────────────────────────────────────────
// Collect all descendant IDs of a category (including itself)
// ─────────────────────────────────────────────────────────────
// Used when seeker selects "Technology" — we want jobs from
// Technology + Frontend + Backend + React + Vue + Node.js etc.
//
// Fetches all categories once, then does in-memory DFS — single DB call

export const getAllDescendantIds = (
  allCategories: IJobCategoryDocument[],
  rootId:        string,
): string[] => {
  const result: string[] = [rootId];

  const findChildren = (parentId: string) => {
    allCategories.forEach((cat) => {
      if (cat.parentId?.toString() === parentId) {
        const childId = (cat._id as string).toString();
        result.push(childId);
        findChildren(childId); // recurse
      }
    });
  };

  findChildren(rootId);
  return result;
};