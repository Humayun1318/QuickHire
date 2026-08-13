import { Document, Model, Types } from 'mongoose';
// ─────────────────────────────────────────────────────────────
// Core interface — user 1:N resume
// A seeker can upload multiple resumes (e.g. different job targets)
// and pick one as the default when applying to jobs.
// ─────────────────────────────────────────────────────────────
export interface IResume {
  // FK → users (the seeker who owns this resume)
  userId: Types.ObjectId;
  // Human-friendly label — e.g. "Backend Developer CV"
  title: string;
  // URL of the stored file — uploaded by the file-storage integration
  fileUrl: string;
  // Only one resume per user can be default at a time
  isDefault: boolean;
  // Cached counter — incremented when an employer downloads/opens the file
  downloadCount: number;
  // Soft delete — preserves application history
  isActive: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}
export interface IResumeDocument extends IResume, Document {}
export interface IResumeModel extends Model<IResumeDocument> {
  // Find an active resume by id that belongs to a user
  isOwnedByUser(
    resumeId: string,
    userId: string,
  ): Promise<IResumeDocument | null>;
  // Count active resumes owned by a user
  countOwnedByUser(userId: string): Promise<number>;
  // Clear the default flag on every active resume for a user
  clearDefaults(userId: string, excludeId?: string): Promise<void>;
}
export interface CreateResumeDTO {
  title: string;
  fileUrl: string;
}
