import { Document } from 'mongoose';

export interface IJob extends Document {
  title: string;
  company: string;
  location: string;
  category: string;
  description: string;
}

export interface CreateJobDTO {
  title: string;
  company: string;
  location: string;
  category: string;
  description: string;
}

export interface UpdateJobDTO {
  title?: string;
  company?: string;
  location?: string;
  category?: string;
  description?: string;
}

export interface JobQueryParams {
  category?: string;
  location?: string;
  search?: string;
}
