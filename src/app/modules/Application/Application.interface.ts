import { Document, Types } from 'mongoose';

export interface IApplication extends Document {
  job_id: Types.ObjectId;
  name: string;
  email: string;
  resume_link: string;
  cover_note: string;
}

export interface CreateApplicationDTO {
  job_id: string;
  name: string;
  email: string;
  resume_link: string;
  cover_note: string;
}
