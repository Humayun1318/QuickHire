import { Document, Types } from 'mongoose';

/* ================================
   ENUMS
================================ */

export enum JobType {
  FULL_TIME = 'Full Time',
  PART_TIME = 'Part Time',
  CONTRACT = 'Contract',
  REMOTE = 'Remote',
  INTERNSHIP = 'Internship',
}

export enum JobCategory {
  DESIGN = 'Design',
  DEVELOPMENT = 'Development',
  MARKETING = 'Marketing',
  SALES = 'Sales',
  FINANCE = 'Finance',
  SUPPORT = 'Support',
  PRODUCT = 'Product',
  DATA = 'Data',
}

export enum JobLocation {
  REMOTE = 'Remote',
  USA = 'USA',
  EUROPE = 'Europe',
  UK = 'UK',
  GERMANY = 'Germany',
  FRANCE = 'France',
  CANADA = 'Canada',
  ASIA = 'Asia',
}

/* ================================
   INTERFACES
================================ */
export interface IJob extends Document {
  _id: Types.ObjectId;
  title: string;
  company: string;
  location: JobLocation;
  category: JobCategory;
  description: string;
  types: JobType[]; // multiple job types allowed
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateJobDTO {
  title: string;
  company: string;
  location: JobLocation;
  category: JobCategory;
  description: string;
  types: JobType[];
}

export interface UpdateJobDTO {
  title?: string;
  company?: string;
  location?: JobLocation;
  category?: JobCategory;
  description?: string;
  types?: JobType[];
}
export interface JobQueryParams {
  category?: JobCategory;
  location?: JobLocation;
  search?: string;
  types?: JobType;
}
