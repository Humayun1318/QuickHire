

import { Document, Model, Types } from 'mongoose';
import {
  ExperienceLevel,
  JobStatus,
  JobType,
  SalaryCurrency,
  WorkMode,
} from './jobListing.constants';

// ─────────────────────────────────────────────────────────────
// Sub-document interfaces
// ─────────────────────────────────────────────────────────────

export interface IJobSalary {
  min?:          number;
  max?:          number;
  currency:      SalaryCurrency;
  isNegotiable:  boolean;
  isVisible:     boolean; // some employers hide salary range
}

export interface IJobLocation {
  city?:    string;
  country?: string;
}

// ─────────────────────────────────────────────────────────────
// Core interface
// ─────────────────────────────────────────────────────────────

export interface IJobListing {
  companyId:        Types.ObjectId;  // FK → companies
  postedBy:         Types.ObjectId;  // FK → users (the member who posted)
  categoryId?:      Types.ObjectId;  // FK → jobCategories
  title:            string;
  slug:             string;          // auto-generated, unique
  description:      string;
  requirements?:    string[];        // bullet-point requirements
  responsibilities?: string[];       // bullet-point responsibilities
  skills:           string[];        // required skill tags
  type:             JobType;
  workMode:         WorkMode;
  experienceLevel?: ExperienceLevel;
  salary?:          IJobSalary;
  location?:        IJobLocation;
  status:           JobStatus;
  isFeatured:       boolean;         // admin-promoted listings
  expiresAt:        Date;
  // Cached counters — avoid aggregation queries on every list render
  viewCount:        number;
  applicationCount: number;
  isActive:         boolean;
  createdAt?:       Date;
  updatedAt?:       Date;
}

// ─────────────────────────────────────────────────────────────
// Mongoose types
// ─────────────────────────────────────────────────────────────

export interface IJobListingDocument extends IJobListing, Document {}

export interface IJobListingModel extends Model<IJobListingDocument> {
  isJobExists(jobId: string): Promise<IJobListingDocument | null>;
  isOwnedByCompany(
    jobId:     string,
    companyId: string,
  ): Promise<IJobListingDocument | null>;
}

// ─────────────────────────────────────────────────────────────
// Query params interface — for search/filter endpoint
// ─────────────────────────────────────────────────────────────

export interface IJobListingQuery {
  searchTerm?:     string;
  categoryId?:     string;
  type?:           JobType;
  workMode?:       WorkMode;
  experienceLevel?: ExperienceLevel;
  city?:           string;
  country?:        string;
  salaryMin?:      number;
  salaryMax?:      number;
  isFeatured?:     boolean;
  companyId?:      string;
  status?:         JobStatus;
  page?:           number;
  limit?:          number;
  sortBy?:         string; // newest | salary | relevance
}