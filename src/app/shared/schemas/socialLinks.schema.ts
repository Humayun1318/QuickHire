import { Schema, model, Types } from 'mongoose';

// Social links — validated at Zod layer, stored as plain strings
export const socialLinksSchema = new Schema(
  {
    linkedin: { type: String, trim: true },
    github: { type: String, trim: true },
    portfolio: { type: String, trim: true },
    twitter: { type: String, trim: true },
  },
  { _id: false, versionKey: false },
);
