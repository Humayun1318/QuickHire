import { Schema, model } from 'mongoose';
import {
  IUser,
  Role,
  IsActive,
  AuthProvider,
  IUserModel,
} from './user.interface';
import bcrypt from 'bcrypt';
import { envVars } from '../../config/env';

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
      trim: true,
    },

    password: {
      type: String,
      select: false,
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

// pre hook to hash password before saving
userSchema.pre('save', async function (next) {
  const user = this;

  if (!user?.password) return next();
  if (!user.isModified('password')) return next();

  user.password = await bcrypt.hash(
    user.password,
    Number(envVars.BCRYPT_SALT_ROUND),
  );

  next();
});

// Static method to find user by ID
userSchema.statics.findUserById = function (id: string) {
  return this.findById(id);
};

// Static method to check if user exists by ID
userSchema.statics.isUserExists = async function (id: string) {
  return !!(await this.exists({ _id: id }));
};

// Static method to find user by email
userSchema.statics.findUserByEmail = function (email: string) {
  return this.findOne({ email }).select('+password');
};

// Method to compare passwords
userSchema.methods.comparePassword = function (password: string) {
  return bcrypt.compare(password, this.password);
};

export const User = model<IUser, IUserModel>('User', userSchema);
