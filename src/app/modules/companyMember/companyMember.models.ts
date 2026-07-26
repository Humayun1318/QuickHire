

import { Schema, model } from 'mongoose';
import { CompanyMemberRole } from './companyMember.constants';
import {
    ICompanyMemberDocument,
    ICompanyMemberModel,
} from './companyMember.interface';

const companyMemberSchema = new Schema<
    ICompanyMemberDocument,
    ICompanyMemberModel
>(
    {
        companyId: {
            type: Schema.Types.ObjectId,
            ref: 'Company',
            required: [true, 'Company ID is required'],
        },

        userId: {
            type: Schema.Types.ObjectId,
            ref: 'User',
            required: [true, 'User ID is required'],
        },

        role: {
            type: String,
            enum: Object.values(CompanyMemberRole),
            required: [true, 'Member role is required'],
        },

        // Tracks who invited this member — useful for audit logs and UI display
        invitedBy: {
            type: Schema.Types.ObjectId,
            ref: 'User',
        },

        joinedAt: {
            type: Date,
            default: Date.now,
        },

        // Soft remove: set isActive false instead of deleting
        // Preserves the invitation/activity history
        isActive: {
            type: Boolean,
            default: true,
        },
    },
    {
        timestamps: true,
        versionKey: false,
    },
);

// ─────────────────────────────────────────────────────────────
// Indexes
// ─────────────────────────────────────────────────────────────

// Compound unique index — a user can only be a member of a company once
// This prevents duplicate member entries regardless of role
companyMemberSchema.index({ companyId: 1, userId: 1 }, { unique: true });

// Primary list query: fetch all members of a company
companyMemberSchema.index({ companyId: 1, isActive: 1 });

// Permission check index — used in requireCompanyRole middleware on every request
// Covers: findOne({ companyId, userId }) for role lookup
companyMemberSchema.index({ companyId: 1, userId: 1, role: 1 });

// ─────────────────────────────────────────────────────────────
// Static Methods
// ─────────────────────────────────────────────────────────────

// Used before adding a member — prevents duplicates
companyMemberSchema.statics.isMemberExists = async function (
    companyId: string,
    userId: string,
): Promise<ICompanyMemberDocument | null> {
    return this.findOne({ companyId, userId, isActive: true });
};

// Used in permission middleware and update/remove operations
companyMemberSchema.statics.getMemberWithRole = async function (
    companyId: string,
    userId: string,
): Promise<ICompanyMemberDocument | null> {
    return this.findOne({ companyId, userId, isActive: true });
};

export const CompanyMember = model<
    ICompanyMemberDocument,
    ICompanyMemberModel
>('CompanyMember', companyMemberSchema);