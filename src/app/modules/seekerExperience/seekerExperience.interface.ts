
import { Document, Model, Types } from 'mongoose';
import { EmploymentType, WorkMode } from './seekerExperience.constants';

export interface ISeekerExperience {
  profileId: Types.ObjectId;   // FK → seekerProfiles
  userId: Types.ObjectId;      // Denormalized for ownership checks
  jobTitle: string;
  company: string;
  employmentType: EmploymentType;
  workMode?: WorkMode;
  location?: string;           // e.g. "Dhaka, Bangladesh" or "Remote"
  startDate: Date;
  endDate?: Date;              // null = current job
  isCurrentJob: boolean;
  responsibilities?: string[]; // bullet points for resume-style display
  technologiesUsed?: string[]; // e.g. ["Node.js", "React", "PostgreSQL"]
  createdAt?: Date;
  updatedAt?: Date;
}

export interface ISeekerExperienceDocument
  extends ISeekerExperience,
    Document {}

export interface ISeekerExperienceModel
  extends Model<ISeekerExperienceDocument> {
  isOwnedByUser(
    experienceId: string,
    userId: string,
  ): Promise<ISeekerExperienceDocument | null>;
}