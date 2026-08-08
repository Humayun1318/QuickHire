import { Schema, model } from 'mongoose';
import {
  ExperienceLevel,
  JobStatus,
  JobType,
  SalaryCurrency,
  WorkMode,
  DEFAULT_JOB_EXPIRY_DAYS,
} from './jobListing.constants';
import {
  IJobListingDocument,
  IJobListingModel,
} from './jobListing.interface';

// ─────────────────────────────────────────────────────────────
// Sub-schemas
// ─────────────────────────────────────────────────────────────

const salarySchema = new Schema(
  {
    min:          { type: Number, min: 0 },
    max:          { type: Number, min: 0 },
    currency:     {
      type:    String,
      enum:    Object.values(SalaryCurrency),
      default: SalaryCurrency.BDT,
    },
    isNegotiable: { type: Boolean, default: true },
    // When false, salary is hidden on the public listing — employer preference
    isVisible:    { type: Boolean, default: true },
  },
  { _id: false, versionKey: false },
);

const locationSchema = new Schema(
  {
    city:    { type: String, trim: true },
    country: { type: String, trim: true },
  },
  { _id: false, versionKey: false },
);

// ─────────────────────────────────────────────────────────────
// Main schema
// ─────────────────────────────────────────────────────────────

const jobListingSchema = new Schema<IJobListingDocument, IJobListingModel>(
  {
    companyId: {
      type:     Schema.Types.ObjectId,
      ref:      'Company',
      required: [true, 'Company ID is required'],
    },

    // Tracks which company member posted the job — useful for audit
    postedBy: {
      type:     Schema.Types.ObjectId,
      ref:      'User',
      required: [true, 'Posted by user ID is required'],
    },

    categoryId: {
      type: Schema.Types.ObjectId,
      ref:  'JobCategory',
    },

    title: {
      type:      String,
      required:  [true, 'Job title is required'],
      trim:      true,
      maxlength: [150, 'Job title cannot exceed 150 characters'],
    },

    // Auto-generated from title + short unique suffix to handle duplicate titles
    slug: {
      type:   String,
      unique: true,
      trim:   true,
    },

    description: {
      type:     String,
      required: [true, 'Job description is required'],
      trim:     true,
    },

    requirements: {
      type:    [String],
      default: [],
    },

    responsibilities: {
      type:    [String],
      default: [],
    },

    // Normalized to lowercase for consistent search and tag-based filtering
    skills: {
      type:    [String],
      default: [],
      set:     (skills: string[]) =>
        skills.map((s) => s.toLowerCase().trim()),
    },

    type: {
      type:     String,
      enum:     Object.values(JobType),
      required: [true, 'Job type is required'],
    },

    workMode: {
      type:     String,
      enum:     Object.values(WorkMode),
      required: [true, 'Work mode is required'],
    },

    experienceLevel: {
      type: String,
      enum: Object.values(ExperienceLevel),
    },

    salary:   { type: salarySchema,   default: undefined },
    location: { type: locationSchema, default: undefined },

    status: {
      type:    String,
      enum:    Object.values(JobStatus),
      default: JobStatus.DRAFT,
    },

    // Set by admin — featured jobs appear at top of search results
    isFeatured: {
      type:    Boolean,
      default: false,
    },

    // Default: 30 days from creation, set in pre-save hook
    expiresAt: {
      type:     Date,
      required: [true, 'Expiry date is required'],
    },

    // Cached counters — maintained via $inc in application service
    viewCount: {
      type:    Number,
      default: 0,
      min:     0,
    },

    applicationCount: {
      type:    Number,
      default: 0,
      min:     0,
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

// MongoDB text index — powers the keyword search (title, description, skills)
// Weights prioritize title matches over description matches
jobListingSchema.index(
  {
    title:       'text',
    description: 'text',
    skills:      'text',
  },
  {
    weights: {
      title:       10,  // title match is most relevant
      skills:       5,  // skill match is second
      description:  1,  // description match is least weighted
    },
    name: 'job_text_search',
  },
);

// Primary public listing query: published + active + not expired, newest first
jobListingSchema.index({
  status:    1,
  isActive:  1,
  expiresAt: 1,
  createdAt: -1,
});

// Company dashboard: employer viewing their own job listings
jobListingSchema.index({ companyId: 1, status: 1, createdAt: -1 });

// Filter indexes — cover the most common search filter combinations
jobListingSchema.index({ type: 1, workMode: 1, status: 1 });
jobListingSchema.index({ categoryId: 1, status: 1 });
jobListingSchema.index({ skills: 1, status: 1 });
jobListingSchema.index({ experienceLevel: 1, status: 1 });
jobListingSchema.index({ 'location.city': 1, 'location.country': 1 });

// Featured jobs — homepage and promoted listings query
jobListingSchema.index({ isFeatured: 1, status: 1, expiresAt: 1 });

// ─────────────────────────────────────────────────────────────
// Static Methods
// ─────────────────────────────────────────────────────────────

jobListingSchema.statics.isJobExists = async function (
  jobId: string,
): Promise<IJobListingDocument | null> {
  return this.findOne({ _id: jobId, isActive: true });
};

jobListingSchema.statics.isOwnedByCompany = async function (
  jobId:     string,
  companyId: string,
): Promise<IJobListingDocument | null> {
  return this.findOne({ _id: jobId, companyId, isActive: true });
};

// ─────────────────────────────────────────────────────────────
// Hooks
// ─────────────────────────────────────────────────────────────

jobListingSchema.pre('save', function (next) {
  // Auto-generate slug from title on creation or title change
  // Append a short random suffix to handle duplicate titles
  // e.g. "senior-react-developer-k7x2" — human-readable + unique
  if (this.isNew || this.isModified('title')) {
    const base = this.title
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-');

    const suffix = Math.random().toString(36).substring(2, 6);
    this.slug = `${base}-${suffix}`;
  }

  // Auto-set default expiresAt on creation if not provided
  if (this.isNew && !this.expiresAt) {
    const expiry = new Date();
    expiry.setDate(expiry.getDate() + DEFAULT_JOB_EXPIRY_DAYS);
    this.expiresAt = expiry;
  }

  next();
});

export const JobListing = model<IJobListingDocument, IJobListingModel>(
  'JobListing',
  jobListingSchema,
);