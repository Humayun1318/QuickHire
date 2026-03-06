import { Schema, model } from 'mongoose';
import {
  IJob,
  JobCategory,
  JobLocation,
  JobType,
} from './jobListing.interface';

const jobSchema = new Schema<IJob>(
  {
    title: {
      type: String,
      required: [true, 'Title is required'],
      trim: true,
    },
    company: {
      type: String,
      required: [true, 'Company is required'],
      trim: true,
    },
    location: {
      type: String,
      required: [true, 'Location is required'],
      enum: Object.values(JobLocation),
    },
    category: {
      type: String,
      required: [true, 'Category is required'],
      enum: Object.values(JobCategory),
    },
    types: {
      type: [String],
      enum: Object.values(JobType),
      required: true,
      validate: {
        validator: function (value: string[]) {
          return Array.isArray(value) && value.length > 0;
        },
        message: 'At least one job type is required',
      },
    },
    description: {
      type: String,
      required: [true, 'Description is required'],
    },
  },
  {
    timestamps: true,
    strict: 'throw',
  },
);

export const Job = model<IJob>('Job', jobSchema);
