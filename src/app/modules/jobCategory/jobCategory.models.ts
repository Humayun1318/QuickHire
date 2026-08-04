
import { Schema, model } from 'mongoose';
import {
  IJobCategoryDocument,
  IJobCategoryModel,
} from './jobCategory.interface';

const jobCategorySchema = new Schema<IJobCategoryDocument, IJobCategoryModel>(
  {
    name: {
      type:      String,
      required:  [true, 'Category name is required'],
      trim:      true,
      unique:    true,
      maxlength: [80, 'Category name cannot exceed 80 characters'],
    },

    // Auto-generated in pre-save hook from name
    slug: {
      type:   String,
      unique: true,
      trim:   true,
    },

    icon: {
      type: String,
      trim: true,
    },

    // Self-referencing FK — null for root categories
    // Using Schema.Types.ObjectId with ref to same model enables
    // .populate('parentId') to resolve parent category details
    parentId: {
      type:    Schema.Types.ObjectId,
      ref:     'JobCategory',
      default: null,
    },

    // Cached counter — avoids countDocuments() on every category list render
    // Maintained via increment/decrement in jobListing service
    jobCount: {
      type:    Number,
      default: 0,
      min:     0, // prevent negative counts from race conditions
    },

    isActive: {
      type:    Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
    versionKey: false,
    toJSON: {
      transform: (_doc, ret) => {
        delete ret.__v;
        return ret;
      },
    },
  },
);

// ─────────────────────────────────────────────────────────────
// Indexes
// ─────────────────────────────────────────────────────────────

// slug is the primary public lookup key (/categories/frontend)
jobCategorySchema.index({ slug: 1 });

// parentId index — primary query for tree building: find({ parentId: null })
// and find({ parentId: <id> }) for children
jobCategorySchema.index({ parentId: 1 });

// Compound: active root categories sorted — homepage category menu query
jobCategorySchema.index({ parentId: 1, isActive: 1, jobCount: -1 });

// ─────────────────────────────────────────────────────────────
// Static Methods
// ─────────────────────────────────────────────────────────────

jobCategorySchema.statics.isCategoryExists = async function (
  categoryId: string,
): Promise<IJobCategoryDocument | null> {
  return this.findOne({ _id: categoryId, isActive: true });
};

// Checks if a name is taken, optionally excluding a specific document
// Used for both create (no excludeId) and update (pass current doc _id)
jobCategorySchema.statics.isCategoryNameTaken = async function (
  name:      string,
  excludeId?: string,
): Promise<boolean> {
  const query: Record<string, unknown> = {
    name: { $regex: new RegExp(`^${name}$`, 'i') }, // case-insensitive match
  };
  if (excludeId) {
    query._id = { $ne: excludeId };
  }
  const existing = await this.findOne(query);
  return !!existing;
};

// ─────────────────────────────────────────────────────────────
// Hooks
// ─────────────────────────────────────────────────────────────

// Auto-generate slug from name on create or name change
jobCategorySchema.pre('save', function (next) {
  if (this.isNew || this.isModified('name')) {
    this.slug = this.name
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-');
  }
  next();
});

export const JobCategory = model<IJobCategoryDocument, IJobCategoryModel>(
  'JobCategory',
  jobCategorySchema,
);