import { Document, Model, Types } from 'mongoose';
import {
  CompanyIndustry,
  CompanySize,
  CompanyVerificationStatus,
} from './company.constants';
import { IAddress } from '../../shared/interfaces/address.types';
import { ISocialLinks } from '../../shared/interfaces/socialLinks.types';


// ─────────────────────────────────────────────────────────────
// Core company interface
// ─────────────────────────────────────────────────────────────

export interface ICompany {
  ownerId:             Types.ObjectId; // FK → users (1:1 — one employer, one company)
  name:                string;
  slug:                string;         // URL-safe unique identifier, auto-generated
  logo?:               string;         // Cloudinary URL
  banner?:             string;         // Cloudinary URL
  description?:        string;
  industry?:           CompanyIndustry;
  size?:               CompanySize;
  website?:            string;
  address?:            IAddress;
  socialLinks?:        ISocialLinks;
  verificationStatus:  CompanyVerificationStatus;
  verificationNote?:   string;         // admin-written reason for rejection
  isActive:            boolean;        // soft delete flag
  createdAt?:          Date;
  updatedAt?:          Date;
}

// ─────────────────────────────────────────────────────────────
// Mongoose Document type
// ─────────────────────────────────────────────────────────────

export interface ICompanyDocument extends ICompany, Document {}

// ─────────────────────────────────────────────────────────────
// Mongoose Model type — static methods attached here
// ─────────────────────────────────────────────────────────────

export interface ICompanyModel extends Model<ICompanyDocument> {
  isCompanyExists(companyId: string): Promise<ICompanyDocument | null>;
  isOwnedByUser(companyId: string, ownerId: string): Promise<ICompanyDocument | null>;
  hasExistingCompany(ownerId: string): Promise<ICompanyDocument | null>;
}