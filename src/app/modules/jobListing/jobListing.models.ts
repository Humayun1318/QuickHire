import { Schema, model, Document } from 'mongoose';
import { IJob } from './jobListing.interface';



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
      trim: true,
    },
    category: {
      type: String,
      required: [true, 'Category is required'],
      enum: [
        'Technology',
        'Healthcare',
        'Finance',
        'Education',
        'Retail',
        'Other',
      ],
    },
    description: {
      type: String,
      required: [true, 'Description is required'],
    },
  },
  {
    timestamps: true,
  },
);

export const Job = model<IJob>('Job', jobSchema);
