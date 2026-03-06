import { Schema, model } from 'mongoose';
import { IUser, Role, IsActive, AuthProvider } from './user.interface';
import { lowercase, trim } from 'zod';

const authProviderSchema = new Schema(
  {
    provider: {
      type: String,
      enum: Object.values(AuthProvider),
      required: true,
    },

    providerId: {
      type: String,
      required: true,
    },
  },
  { _id: false, versionKey: false },
);

const userSchema = new Schema<IUser>(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },

    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
    },

    password: {
      type: String,
      select: 0,
    },

    phone: String,
    picture: String,
    address: String,

    role: {
      type: String,
      enum: Object.values(Role),
      default: Role.USER,
    },

    skills: [
      {
        type: String,
        required: true,
        lowercase: true,
        trim: true,
      },
    ],

    experience: {
      type: Number,
      default: 0,
    },

    resume: String,

    appliedJobs: [
      {
        type: Schema.Types.ObjectId,
        ref: 'Job',
      },
    ],

    isDeleted: {
      type: Boolean,
      default: false,
    },

    isActive: {
      type: String,
      enum: Object.values(IsActive),
      default: IsActive.ACTIVE,
    },

    isVerified: {
      type: Boolean,
      default: false,
    },

    auths: [authProviderSchema],
  },
  {
    timestamps: true,
    versionKey: false,
  },
);

export const User = model<IUser>('User', userSchema);
