import { Schema, model } from 'mongoose';
import { IResumeDocument, IResumeModel } from './resume.interface';
// ─────────────────────────────────────────────────────────────
// Schema
// ─────────────────────────────────────────────────────────────
const resumeSchema = new Schema<IResumeDocument, IResumeModel>(
  {
    // FK → users — non-nullable, one user owns many resumes (1:N)
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'User ID is required'],
    },
    title: {
      type: String,
      required: [true, 'Resume title is required'],
      trim: true,
      maxlength: [80, 'Resume title cannot exceed 80 characters'],
    },
    // URL of the uploaded file — non-nullable, set by the file storage
    fileUrl: {
      type: String,
      required: [true, 'Resume file URL is required'],
      trim: true,
    },
    // Per-user toggle — maintained by the service layer when the
    // seeker picks a default resume. A unique index across (userId,
    // isDefault) is NOT feasible in MongoDB, so the service keeps it
    // consistent with clearDefaults().
    isDefault: {
      type: Boolean,
      default: false,
    },
    // Cached counter — incremented by $inc in the application service
    // when an employer views/downloads the attached resume
    downloadCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    // Soft delete — deleted resumes keep application history intact
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
// Most common access pattern: "my resumes" — one query per user
resumeSchema.index({ userId: 1, isActive: 1, createdAt: -1 });
// Default resume lookup per user — supports findOne({ userId, isDefault: true })
resumeSchema.index({ userId: 1, isDefault: 1 });
// ─────────────────────────────────────────────────────────────
// Static methods
// ─────────────────────────────────────────────────────────────
// Returns the resume only if it is active and belongs to the user.
// Used in update/delete to block cross-user access.
resumeSchema.statics.isOwnedByUser = async function (
  resumeId: string,
  userId: string,
): Promise<IResumeDocument | null> {
  return this.findOne({ _id: resumeId, userId, isActive: true });
};
// Count of active resumes for a user — used to enforce the per-user cap
resumeSchema.statics.countOwnedByUser = async function (
  userId: string,
): Promise<number> {
  return this.countDocuments({ userId, isActive: true });
};
// Remove the default flag from every active resume of a user.
// Optionally keep one resume as default (used when setting a new default).
resumeSchema.statics.clearDefaults = async function (
  userId: string,
  excludeId?: string,
) {
  const query: Record<string, unknown> = {
    userId,
    isActive: true,
    isDefault: true,
  };
  if (excludeId) {
    query._id = { $ne: excludeId };
  }
  await this.updateMany(query, { $set: { isDefault: false } });
};
export const Resume = model<IResumeDocument, IResumeModel>(
  'Resume',
  resumeSchema,
);
