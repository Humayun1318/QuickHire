import { Schema, model } from 'mongoose';
import { DegreeType } from './seekerEducation.constants';
import {
    ISeekerEducationDocument,
    ISeekerEducationModel,
} from './seekerEducation.interface';

const seekerEducationSchema = new Schema<
    ISeekerEducationDocument,
    ISeekerEducationModel
>(
    {
        // Ref to the parent seeker profile — primary relationship
        profileId: {
            type: Schema.Types.ObjectId,
            ref: 'SeekerProfile',
            required: [true, 'Profile ID is required'],
        },

        // Denormalized userId allows ownership checks without an extra join to SeekerProfile
        // Trade-off: slight data duplication, but avoids N+1 queries on authorization
        userId: {
            type: Schema.Types.ObjectId,
            ref: 'User',
            required: [true, 'User ID is required'],
        },

        institution: {
            type: String,
            required: [true, 'Institution name is required'],
            trim: true,
        },

        degree: {
            type: String,
            enum: Object.values(DegreeType),
            required: [true, 'Degree type is required'],
        },

        fieldOfStudy: {
            type: String,
            trim: true,
        },

        startDate: {
            type: Date,
            required: [true, 'Start date is required'],
        },

        // endDate is null when isCurrentlyStudying is true
        endDate: {
            type: Date,
            default: null,
        },

        grade: {
            type: String,
            trim: true,
        },

        description: {
            type: String,
            trim: true,
            maxlength: [500, 'Description cannot exceed 500 characters'],
        },

        isCurrentlyStudying: {
            type: Boolean,
            default: false,
        },
    },
    {
        timestamps: true,
        versionKey: false,
        // toJSON: {
        //     transform: (_doc, ret) => {
        //         delete ret.__v;
        //         return ret;
        //     },
        // },
    },
);

// ─────────────────────────────────────────────────────────────
// Indexes
// ─────────────────────────────────────────────────────────────

// Primary query pattern: fetch all education for a profile, sorted by date
seekerEducationSchema.index({ profileId: 1, startDate: -1 });

// Ownership check index — used in every mutating operation
seekerEducationSchema.index({ _id: 1, userId: 1 });

// ─────────────────────────────────────────────────────────────
// Static Methods
// ─────────────────────────────────────────────────────────────

// Returns the record only if it belongs to the requesting user.
// Used in update/delete to prevent unauthorized modifications.
seekerEducationSchema.statics.isOwnedByUser = async function (
    educationId: string,
    userId: string,
): Promise<ISeekerEducationDocument | null> {
    return this.findOne({ _id: educationId, userId });
};

export const SeekerEducation = model<
    ISeekerEducationDocument,
    ISeekerEducationModel
>('SeekerEducation', seekerEducationSchema);