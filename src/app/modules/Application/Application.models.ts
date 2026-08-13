import { Schema, model } from 'mongoose';
import {
  IApplicationDocument,
  IApplicationModel,
} from './Application.interface';
import { ApplicationStatus } from './Application.constants';
// ─────────────────────────────────────────────────────────────
// Schema — matches the reference ERD:
//   applications { id, jobId, applicantId, resumeId, coverLetter,
//                  status, employerNote, score, appliedAt, updatedAt }
// ─────────────────────────────────────────────────────────────
const applicationSchema = new Schema<IApplicationDocument, IApplicationModel>(
  {
    // FK → jobListings — non-nullable
    jobId: {
      type: Schema.Types.ObjectId,
      ref: 'JobListing',
      required: [true, 'Job ID is required'],
    },
    // FK → users — non-nullable, the applicant (must be SEEKER)
    applicantId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Applicant ID is required'],
    },
    // FK → resumes — non-nullable, must belong to the applicant
    resumeId: {
      type: Schema.Types.ObjectId,
      ref: 'Resume',
      required: [true, 'Resume ID is required'],
    },
    coverLetter: {
      type: String,
      required: [true, 'Cover letter is required'],
      trim: true,
      maxlength: [2000, 'Cover letter cannot exceed 2000 characters'],
    },
    status: {
      type: String,
      enum: Object.values(ApplicationStatus),
      default: ApplicationStatus.PENDING,
    },
    // Employer-side fields — left optional; the employer who owns
    // the job's company fills them in during review
    employerNote: {
      type: String,
      trim: true,
      maxlength: [1000, 'Employer note cannot exceed 1000 characters'],
    },
    // Integer score 0-100 — validated by zod + mongoose min/max
    score: {
      type: Number,
      min: 0,
      max: 100,
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
// One application per seeker per job — duplicate applications are
// rejected at the schema level as well as in the service layer
applicationSchema.index(
  { applicantId: 1, jobId: 1 },
  { unique: true, name: 'one_application_per_applicant_per_job' },
);
// Employer dashboard: "applications for my job" — newest first
applicationSchema.index({ jobId: 1, createdAt: -1 });
// Seeker dashboard: "my applications" — newest first
applicationSchema.index({ applicantId: 1, createdAt: -1 });
// Resume lookup — which applications use this resume
applicationSchema.index({ resumeId: 1 });
// ─────────────────────────────────────────────────────────────
// Static methods
// ─────────────────────────────────────────────────────────────
// Returns the application only if it belongs to the given applicant —
// used in seeker-side update/delete protection
applicationSchema.statics.isOwnedByApplicant = async function (
  applicationId: string,
  applicantId: string,
): Promise<IApplicationDocument | null> {
  return this.findOne({ _id: applicationId, applicantId });
};
// Duplicate check — one application per seeker per job
applicationSchema.statics.isAlreadyApplied = async function (
  jobId: string,
  applicantId: string,
): Promise<boolean> {
  const existing = await this.findOne({ jobId, applicantId }).lean();
  return !!existing;
};
export const Application = model<IApplicationDocument, IApplicationModel>(
  'Application',
  applicationSchema,
);
