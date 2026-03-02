import { Schema, model, Document, Types } from 'mongoose';
import { IApplication } from './Application.interface';

const applicationSchema = new Schema<IApplication>(
  {
    job_id: {
      type: Schema.Types.ObjectId,
      ref: 'Job',
      required: [true, 'Job ID is required'],
    },
    name: {
      type: String,
      required: [true, 'Name is required'],
      trim: true,
    },
    email: {
      type: String,
      required: [true, 'Email is required'],
      trim: true,
      lowercase: true,
      match: [/^\S+@\S+\.\S+$/, 'Please enter a valid email'],
    },
    resume_link: {
      type: String,
      required: [true, 'Resume link is required'],
      trim: true,
    },
    cover_note: {
      type: String,
      required: [true, 'Cover note is required'],
    },
  },
  {
    timestamps: true,
  },
);

export const Application = model<IApplication>(
  'Application',
  applicationSchema,
);
