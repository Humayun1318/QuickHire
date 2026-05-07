

import { Document, Model, Types } from 'mongoose';
import { DegreeType } from './seekerEducation.constants';

export interface ISeekerEducation {
  profileId: Types.ObjectId;  // FK → seekerProfiles
  userId: Types.ObjectId;     // Denormalized FK → users (for ownership checks without join)
  institution: string;
  degree: DegreeType;
  fieldOfStudy?: string;
  startDate: Date;
  endDate?: Date;             // null = currently studying
  grade?: string;             // e.g. "3.8 GPA" or "First Class"
  description?: string;
  isCurrentlyStudying: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface ISeekerEducationDocument extends ISeekerEducation, Document {}

export interface ISeekerEducationModel extends Model<ISeekerEducationDocument> {
  isOwnedByUser(
    educationId: string,
    userId: string,
  ): Promise<ISeekerEducationDocument | null>;
}