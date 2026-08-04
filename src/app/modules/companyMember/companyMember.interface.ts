import { Document, Model, Types } from 'mongoose';
import { CompanyMemberRole } from './companyMember.constants';

export enum CompanyMemberStatus {
  ACTIVE = 'ACTIVE',
  LEFT = 'LEFT',
  REMOVED = 'REMOVED',
}

export interface ICompanyMember {
  companyId: Types.ObjectId; // FK → companies
  userId: Types.ObjectId; // FK → users
  role: CompanyMemberRole;
  // Invitation tracking — useful for audit and UX ("invited by Rahim")
  invitedBy?: Types.ObjectId; // FK → users (who added this member)
  joinedAt: Date;
  isActive: boolean; // soft remove without losing history
  status?: CompanyMemberStatus; // Status of the member
  createdAt?: Date;
  updatedAt?: Date;
}

export interface ICompanyMemberDocument extends ICompanyMember, Document {}

export interface ICompanyMemberModel extends Model<ICompanyMemberDocument> {
  // Check if user is already a member of a company
  isMemberExists(
    companyId: string,
    userId: string,
  ): Promise<ICompanyMemberDocument | null>;

  // Get a specific member with their role — used in permission middleware
  getMemberWithRole(
    companyId: string,
    userId: string,
  ): Promise<ICompanyMemberDocument | null>;
}
