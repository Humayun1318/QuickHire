
import { Schema, model, Types } from 'mongoose';
import {
    AvailabilityStatus,
    JobPreferenceType,
    PROFILE_COMPLETENESS_WEIGHTS,
    SalaryCurrency,
} from './seekerProfile.constants';
import {
    ISeekerProfileDocument,
    ISeekerProfileModel,
} from './seekerProfile.interface';

// ─────────────────────────────────────────────────────────────
// Sub-schemas — defined separately for reuse and clarity
// ─────────────────────────────────────────────────────────────

// GeoJSON Point sub-schema
// MongoDB requires this exact format for 2dsphere spatial indexing
const geoPointSchema = new Schema(
    {
        type: {
            type: String,
            enum: ['Point'],
            default: 'Point',
        },
        coordinates: {
            type: [Number], // [longitude, latitude] — GeoJSON standard
            required: true,
        },
    },
    { _id: false, versionKey: false }, // no _id needed on sub-documents
);

// Structured address — better than flat fields for geo queries and i18n
const addressSchema = new Schema(
    {
        city: { type: String, required: [true, 'City is required'], trim: true },
        state: { type: String, trim: true },
        country: { type: String, required: [true, 'Country is required'], trim: true },
        postalCode: { type: String, trim: true },
        // Nested GeoJSON for MongoDB geospatial operations
        location: { type: geoPointSchema, default: undefined },
    },
    { _id: false, versionKey: false },
);

// Social links — validated at Zod layer, stored as plain strings
const socialLinksSchema = new Schema(
    {
        linkedin: { type: String, trim: true },
        github: { type: String, trim: true },
        portfolio: { type: String, trim: true },
        twitter: { type: String, trim: true },
    },
    { _id: false, versionKey: false },
);

// Expected salary — stored as structured object for currency-aware filtering
const expectedSalarySchema = new Schema(
    {
        amount: { type: Number, min: 0 },
        currency: { type: String, enum: Object.values(SalaryCurrency), default: SalaryCurrency.BDT },
        isNegotiable: { type: Boolean, default: true },
    },
    { _id: false, versionKey: false },
);

// ─────────────────────────────────────────────────────────────
// Main schema
// ─────────────────────────────────────────────────────────────

const seekerProfileSchema = new Schema<
    ISeekerProfileDocument,
    ISeekerProfileModel
>(
    {
        // FK reference — enforces 1:1 with users collection
        userId: {
            type: Schema.Types.ObjectId,
            ref: 'User',
            required: [true, 'User ID is required'],
            unique: true, // ensures one profile per user
        },

        headline: {
            type: String,
            trim: true,
            maxlength: [120, 'Headline cannot exceed 120 characters'],
        },

        bio: {
            type: String,
            trim: true,
            maxlength: [1000, 'Bio cannot exceed 1000 characters'],
        },

        address: {
            type: addressSchema,
            default: undefined,
        },

        // Array of skill strings — indexed for search performance
        skills: {
            type: [String],
            default: [],
            // Normalize to lowercase for consistent filtering
            set: (skills: string[] = []) => skills.map((s) => s.toLowerCase().trim()),
        },

        languages: {
            type: [String],
            default: [],
            set: (languages: string[] = []) => languages.map((l) => l.toLowerCase().trim()),
        },

        expectedSalary: {
            type: expectedSalarySchema,
            default: undefined,
        },

        jobPreference: {
            type: String,
            enum: Object.values(JobPreferenceType),
        },

        availabilityStatus: {
            type: String,
            enum: Object.values(AvailabilityStatus),
            default: AvailabilityStatus.OPEN,
        },

        socialLinks: {
            type: socialLinksSchema,
            default: undefined,
        },

        // Cached completeness score — recalculated on every save via pre-save hook
        // Storing it avoids expensive recalculation on list queries
        profileCompleteness: {
            type: Number,
            default: 0,
            min: 0,
            max: 100,
        },

        isActive: {
            type: Boolean,
            default: true,
        },
    },
    {
        timestamps: true,
        // Exclude __v from all responses — it's an internal Mongoose version key
        versionKey: false,
        // toJSON: {
        //     transform: (_doc, ret) => {
        //         // Remove internal fields from API responses
        //         delete ret.__v;
        //         return ret;
        //     },
        // },
    },
);

// ─────────────────────────────────────────────────────────────
// Indexes
// ─────────────────────────────────────────────────────────────

// userId is already unique — covers findOne({ userId }) queries
seekerProfileSchema.index({ userId: 1 });

// Geospatial index — enables $near and $geoWithin queries
// Required for "jobs near me" or "seekers near location" features
seekerProfileSchema.index({ 'address.location': '2dsphere' });

// Composite index for employer search: skill + availability + jobPreference
// Covers the most common employer search pattern
// seekerProfileSchema.index({
//     skills: 1,
//     availabilityStatus: 1,
//     jobPreference: 1,
// });

// ─────────────────────────────────────────────────────────────
// Instance Methods
// ─────────────────────────────────────────────────────────────

// Calculates profile completeness score (0–100) based on filled fields.
// Called in pre-save hook so the cached value is always current.
seekerProfileSchema.methods.calculateCompleteness = function (): number {
    let score = 0;
    const weights = PROFILE_COMPLETENESS_WEIGHTS;

    if (this.headline) score += weights.headline;  //10
    if (this.bio) score += weights.bio; //10
    if (this.address?.city && this.address?.country) score += weights.address; //10
    if (this.skills?.length) score += weights.skills; //15
    if (this.expectedSalary) score += weights.expectedSalary; //5
    if (this.jobPreference) score += weights.jobPreference; //5
    if (this.availabilityStatus !== AvailabilityStatus.NOT_LOOKING)
        score += weights.availabilityStatus; //5
    if (
        this.socialLinks?.linkedin ||
        this.socialLinks?.github ||
        this.socialLinks?.portfolio
    ) score += weights.socialLinks; //10

    // Experience and education completeness is set externally via 
    // seekerExperience and seekerEducation services after their creation
    return Math.min(score, 100);
};

// ─────────────────────────────────────────────────────────────
// Static Methods
// ─────────────────────────────────────────────────────────────

// Checks whether a profile exists for a given userId.
// Used in service layer to prevent duplicate profiles and validate operations.
seekerProfileSchema.statics.isProfileExists = async function (
    userId: string,
): Promise<ISeekerProfileDocument | null> {
    return this.findOne({ userId, isActive: true });
};

// ─────────────────────────────────────────────────────────────
// Hooks
// ─────────────────────────────────────────────────────────────

// Pre-save: recalculate and cache profile completeness score
// Runs on both create and update via save()
seekerProfileSchema.pre('save', function (next) {
    this.profileCompleteness = this.calculateCompleteness();
    next();
});

// Pre-findOneAndUpdate: recalculate completeness when updating via findOneAndUpdate
// Note: 'this' here is the query, not the document
// seekerProfileSchema.pre('findOneAndUpdate', async function (next) {
//     const update = this.getUpdate() as Record<string, any>;

//     // when education and experience are updated, they call this hook but they don't update seeker profile directly, so we need to skip completeness calculation in that case
//     if (update['$inc']?.profileCompleteness !== undefined) {
//         return next();
//     }
//     if (update) {
//         // Fetch the current doc to merge with incoming updates for accurate scoring
//         const doc = await this.model.findOne(this.getQuery());
//         if (doc) {
//             const merged = Object.assign(doc.toObject(), update['$set'] ?? update);
//             // Temporarily assign to calculate
//             const tempScore = Object.keys(PROFILE_COMPLETENESS_WEIGHTS).reduce(
//                 (score, key) => {
//                     if (merged[key]) return score + PROFILE_COMPLETENESS_WEIGHTS[key];
//                     return score;
//                 },
//                 0,
//             );
//             this.setUpdate({
//                 ...update,
//                 $set: {
//                     ...(update['$set'] as object),
//                     profileCompleteness: Math.min(tempScore, 100),
//                 },
//             });
//         }
//      console.log('Pre-update hook: recalculated profileCompleteness:', this.getUpdate());
//     }
//     next();
// });
seekerProfileSchema.pre('findOneAndUpdate', async function (next) {
    const update = this.getUpdate() as Record<string, any>;

    // Skip recalculation when only incrementing/decrementing completeness
    if (update['$inc']?.profileCompleteness !== undefined) {
        return next();
    }

    // Get current document from DB
    const doc = await this.model.findOne(this.getQuery());

    if (!doc) {
        return next();
    }

    // Merge existing data + incoming update
    const mergedData = {
        ...doc.toObject(),
        ...(update.$set ?? update),
    };

    // Create temporary mongoose document
    const tempDoc = new this.model(mergedData);

    // Preserve externally added completeness
    const existingExtraCompleteness =
        doc.profileCompleteness - doc.calculateCompleteness();

    // Recalculate
    const recalculated =
        tempDoc.calculateCompleteness() + existingExtraCompleteness;

    // Inject updated completeness into update query
    this.setUpdate({
        ...update,
        $set: {
            ...(update.$set || {}),
            profileCompleteness: Math.min(recalculated, 100),
        },
    });

    next();
});

export const SeekerProfile = model<ISeekerProfileDocument, ISeekerProfileModel>(
    'SeekerProfile',
    seekerProfileSchema,
);