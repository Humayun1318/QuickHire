import { Schema, model } from 'mongoose';
import {
  CompanyIndustry,
  CompanySize,
  CompanyVerificationStatus,
} from './company.constants';
import { ICompanyDocument, ICompanyModel } from './company.interface';
import { addressSchema } from '../../shared/schemas/address.schema';
import { socialLinksSchema } from '../../shared/schemas/socialLinks.schema';
import { generateSlug, normalizeName } from './company.utils';

// ─────────────────────────────────────────────────────────────
// Main schema
// ─────────────────────────────────────────────────────────────

const companySchema = new Schema<ICompanyDocument, ICompanyModel>(
  {
    // 1:1 with users — enforced by unique index below
    // An employer can own exactly one company
    ownerId: {
      type:     Schema.Types.ObjectId,
      ref:      'User',
      required: [true, 'Owner ID is required'],
      unique:   true,
    },

    name: {
      type:      String,
      required:  [true, 'Company name is required'],
      trim:      true,
      maxlength: [100, 'Company name cannot exceed 100 characters'],
    },

    // Auto-generated from name in pre-save hook
    // Stored separately so it can be indexed and used in URLs without
    // re-generating on every request
    slug: {
      type:   String,
      unique: true,
      trim:   true,
    },

    logo:   { type: String, trim: true }, // Cloudinary URL
    banner: { type: String, trim: true }, // Cloudinary URL

    description: {
      type:      String,
      trim:      true,
      maxlength: [2000, 'Description cannot exceed 2000 characters'],
    },

    industry: {
      type: String,
      enum: Object.values(CompanyIndustry),
    },

    size: {
      type: String,
      enum: Object.values(CompanySize),
    },

    website: {
      type: String,
      trim: true,
    },

    address:     { type: addressSchema,     default: null },
    socialLinks: { type: socialLinksSchema, default: null },

    // Admin-controlled — employers cannot set this themselves
    verificationStatus: {
      type:    String,
      enum:    Object.values(CompanyVerificationStatus),
      default: CompanyVerificationStatus.UNVERIFIED,
    },

    // Populated by admin when rejecting — shown to employer as feedback
    verificationNote: {
      type: String,
      trim: true,
    },

    isActive: {
      type:    Boolean,
      default: true,
    },
  },
  {
    timestamps:  true,
    versionKey:  false,
    // toJSON: {
    //   transform: (_doc, ret) => {
    //     delete ret.__v;
    //     return ret;
    //   },
    // },
  },
);

// ─────────────────────────────────────────────────────────────
// Indexes
// ─────────────────────────────────────────────────────────────

// ownerId already unique above — covers findOne({ ownerId }) queries
companySchema.index({ ownerId: 1 }, { unique: true });

// slug is the primary lookup key for public company pages (/companies/techcorp)
companySchema.index({ slug: 1 }, { unique: true });

// Geospatial index — enables location-based company/job search
companySchema.index({ 'address.location': '2dsphere' });

// Filter index — most common employer search combination
companySchema.index({ industry: 1, size: 1, verificationStatus: 1 });

// ─────────────────────────────────────────────────────────────
// Static Methods
// ─────────────────────────────────────────────────────────────

// General existence check by companyId — used in job creation, member addition etc.
companySchema.statics.isCompanyExists = async function (
  companyId: string,
): Promise<ICompanyDocument | null> {
  return this.findOne({ _id: companyId, isActive: true });
};

// Ownership check — used before any mutating operation on a company
companySchema.statics.isOwnedByUser = async function (
  companyId: string,
  ownerId: string,
): Promise<ICompanyDocument | null> {
  return this.findOne({ _id: companyId, ownerId, isActive: true });
};

// Prevents an employer from creating a second company
// Called in createCompany service before inserting
companySchema.statics.hasExistingCompany = async function (
  ownerId: string,
): Promise<ICompanyDocument | null> {
  return this.findOne({ ownerId });
};

// ─────────────────────────────────────────────────────────────
// Hooks
// ─────────────────────────────────────────────────────────────

// Pre-save: auto-generate slug from company name
// Runs only on creation (isNew) or when name is modified
// Slugify: lowercase, replace spaces and special chars with hyphens
companySchema.pre('save', function (next) {
  if (this.isNew || this.isModified('name')) {
    this.name = normalizeName(this.name);
    this.slug = generateSlug(this.name);
  }
  next();
});

export const Company = model<ICompanyDocument, ICompanyModel>(
  'Company',
  companySchema,
);