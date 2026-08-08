import { Schema, model } from 'mongoose';
import {
    IJobCategoryDocument,
    IJobCategoryModel,
} from './jobCategory.interface';

const jobCategorySchema = new Schema<IJobCategoryDocument, IJobCategoryModel>(
    {
        name: {
            type: String,
            required: [true, 'Category name is required'],
            trim: true,
            unique: true,
            maxlength: [80, 'Category name cannot exceed 80 characters'],
        },

        // Auto-generated in pre-save hook from name
        slug: {
            type: String,
            unique: true,
            trim: true,
        },

        icon: {
            type: String,
            trim: true,
        },

        // Self-referencing FK — null for root categories
        parentId: {
            type: Schema.Types.ObjectId,
            ref: 'JobCategory',
            default: null,
        },

        // Depth of category in hierarchy — root = 0, child = 1, grandchild = 2, etc.
        depth: {
            type: Number,
            default: 0,
            min: 0,
        },

        // Cached counter — avoids countDocuments() on every category list render
        jobCount: {
            type: Number,
            default: 0,
            min: 0,
        },

        isActive: {
            type: Boolean,
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

jobCategorySchema.index({ slug: 1 });

// below already covers plain `{ parentId }` lookups as a left-prefix, so it
// was just extra write cost for nothing.
jobCategorySchema.index({ parentId: 1, isActive: 1, jobCount: -1 });

// ─────────────────────────────────────────────────────────────
// Static Methods
// ─────────────────────────────────────────────────────────────

jobCategorySchema.statics.isCategoryExists = async function (
    categoryId: string,
): Promise<IJobCategoryDocument | null> {
    return this.findOne({ _id: categoryId, isActive: true });
};

jobCategorySchema.statics.isCategoryNameTaken = async function (
    name: string,
    excludeId?: string,
): Promise<boolean> {
    // Escape regex special chars before building the pattern — a name like
    // "C++ (Backend)" would otherwise break the regex or match unintended
    // documents.
    const escaped = name.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const query: Record<string, unknown> = {
        name: { $regex: new RegExp(`^${escaped}$`, 'i') },
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