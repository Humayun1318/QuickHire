// Tree and breadcrumb utilities live here — not in service —
// because they are pure data-transformation functions with no
// business rules. Keeps the service layer clean.
import { Types } from 'mongoose';
import { JobCategory } from './jobCategory.models';
import { MAX_CATEGORY_DEPTH } from './jobCategory.constants';
import {
  IBreadcrumbItem,
  ICategoryTreeNode,
  IJobCategory,
} from './jobCategory.interface';

// Plain (lean) category as returned by .lean()
export type TLeanCategory = IJobCategory & { _id: Types.ObjectId };

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
  categories: TLeanCategory[],
): ICategoryTreeNode[] => {
  const map: Record<string, ICategoryTreeNode> = {};

  // Pass 1 — populate the map
  categories.forEach((cat) => {
    map[String(cat._id)] = { ...cat, children: [] };
  });

  const roots: ICategoryTreeNode[] = [];

  // Pass 2 — wire parent → child relationships
  categories.forEach((cat) => {
    const node = map[String(cat._id)];
    if (cat.parentId) {
      const parentNode = map[String(cat.parentId)];
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
// At most MAX_CATEGORY_DEPTH + 1 DB queries; the iteration cap also guards
// against an infinite loop should the data ever contain a parent cycle.

export const buildBreadcrumb = async (
  categoryId: string,
): Promise<IBreadcrumbItem[]> => {
  const breadcrumb: IBreadcrumbItem[] = [];
  let currentId: string | null = categoryId;

  for (let i = 0; currentId && i <= MAX_CATEGORY_DEPTH; i++) {
    const category: Pick<
      TLeanCategory,
      '_id' | 'name' | 'slug' | 'parentId'
    > | null = await JobCategory.findById(currentId)
      .select('_id name slug parentId')
      .lean<Pick<TLeanCategory, '_id' | 'name' | 'slug' | 'parentId'>>();

    if (!category) break;

    // Prepend so result is root → leaf order
    breadcrumb.unshift({
      _id: String(category._id),
      name: category.name,
      slug: category.slug,
    });

    currentId = category.parentId ? String(category.parentId) : null;
  }

  return breadcrumb;
};
