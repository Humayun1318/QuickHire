
import { Schema, model } from 'mongoose';
import { EmploymentType, WorkMode } from './seekerExperience.constants';
import {
    ISeekerExperienceDocument,
    ISeekerExperienceModel,
} from './seekerExperience.interface';

const seekerExperienceSchema = new Schema<
    ISeekerExperienceDocument,
    ISeekerExperienceModel
>(
    {
        profileId: {
            type: Schema.Types.ObjectId,
            ref: 'SeekerProfile',
            required: [true, 'Profile ID is required'],
        },

        // Denormalized — avoids joining SeekerProfile for every auth check
        userId: {
            type: Schema.Types.ObjectId,
            ref: 'User',
            required: [true, 'User ID is required'],
        },

        jobTitle: {
            type: String,
            required: [true, 'Job title is required'],
            trim: true,
        },

        company: {
            type: String,
            required: [true, 'Company name is required'],
            trim: true,
        },

        employmentType: {
            type: String,
            enum: Object.values(EmploymentType),
            required: [true, 'Employment type is required'],
        },

        workMode: {
            type: String,
            enum: Object.values(WorkMode),
        },

        location: {
            type: String,
            trim: true,
        },

        startDate: {
            type: Date,
            required: [true, 'Start date is required'],
        },

        endDate: {
            type: Date,
            default: null,
        },

        isCurrentJob: {
            type: Boolean,
            default: false,
        },

        // Stored as array for structured display in profile and resume builder
        responsibilities: {
            type: [String],
            default: [],
            set: (res: string[]) => res.map((r) => r.toLowerCase().trim()),
        },

        // Normalized to lowercase for consistent skill-based search
        technologiesUsed: {
            type: [String],
            default: [],
            set: (techs: string[]) => techs.map((t) => t.toLowerCase().trim()),
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

// Primary list query: all experiences for a profile, newest first
// seekerExperienceSchema.index({ profileId: 1, startDate: -1 });

// Ownership check — used in update/delete authorization
// seekerExperienceSchema.index({ _id: 1, userId: 1 });

// Technology search — employers searching for candidates with specific tech
seekerExperienceSchema.index({ technologiesUsed: 1 });

// ─────────────────────────────────────────────────────────────
// Static Methods
// ─────────────────────────────────────────────────────────────

seekerExperienceSchema.statics.isOwnedByUser = async function (
    experienceId: string,
    userId: string,
): Promise<ISeekerExperienceDocument | null> {
    return this.findOne({ _id: experienceId, userId });
};

export const SeekerExperience = model<
    ISeekerExperienceDocument,
    ISeekerExperienceModel
>('SeekerExperience', seekerExperienceSchema);