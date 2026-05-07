
// Keeping interfaces separate from the model allows reuse in services,
// controllers, and DTOs without importing Mongoose Document types.

import { Document, Model, Types } from 'mongoose';
import {
  AvailabilityStatus,
  JobPreferenceType,
  SalaryCurrency,
} from './seekerProfile.constants';

// ─────────────────────────────────────────────────────────────
// Sub-document interfaces
// ─────────────────────────────────────────────────────────────

// GeoJSON Point — required for MongoDB 2dsphere index
// coordinates: [longitude, latitude] — GeoJSON standard order
export interface IGeoPoint {
  type: 'Point';
  coordinates: [number, number]; // [lng, lat]
}

// Embedded address object — structured for geo queries and readability
export interface IAddress {
  city?: string;
  state?: string;
  country?: string;
  postalCode?: string;
  // GeoJSON format required by MongoDB's $near and $geoWithin operators
  location?: IGeoPoint;
}

// Social/professional links for public profile display
export interface ISocialLinks {
  linkedin?: string;
  github?: string;
  portfolio?: string;
  twitter?: string;
}

// Expected salary with currency — structured for range-based filtering
export interface IExpectedSalary {
  amount: number;
  currency: SalaryCurrency;
  isNegotiable: boolean;
}

// ─────────────────────────────────────────────────────────────
// Core seeker profile interface
// ─────────────────────────────────────────────────────────────

export interface ISeekerProfile {
  userId: Types.ObjectId;       // FK → users
  headline?: string;            // e.g. "Senior React Developer | 5yrs exp"
  bio?: string;                 // longer personal summary
  address?: IAddress;
  skills: string[];             // e.g. ["Node.js", "TypeScript", "MongoDB"]
  languages?: string[];         // spoken languages e.g. ["Bengali", "English"]
  expectedSalary?: IExpectedSalary;
  jobPreference?: JobPreferenceType;
  availabilityStatus: AvailabilityStatus;
  socialLinks?: ISocialLinks;
  // Cached percentage computed on profile update — avoids recalculating on every read
  profileCompleteness: number;
  // Soft-delete friendly — allows hiding profile without data loss
  isActive: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}

// ─────────────────────────────────────────────────────────────
// Mongoose Document type — used inside model methods
// ─────────────────────────────────────────────────────────────

export interface ISeekerProfileDocument extends ISeekerProfile, Document {
  // Instance methods
  calculateCompleteness(): number;
}

// ─────────────────────────────────────────────────────────────
// Mongoose Model type — used for static methods
// ─────────────────────────────────────────────────────────────

export interface ISeekerProfileModel extends Model<ISeekerProfileDocument> {
  // Static method: check profile existence by userId
  isProfileExists(userId: string): Promise<ISeekerProfileDocument | null>;
}