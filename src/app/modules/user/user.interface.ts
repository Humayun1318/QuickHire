import { Model, Types } from 'mongoose';

export enum Role {
  SUPER_ADMIN = 'SUPER_ADMIN',
  ADMIN = 'ADMIN',
  USER = 'USER',
  RECRUITER = 'RECRUITER',
}

export enum AuthProvider {
  GOOGLE = 'google',
  CREDENTIALS = 'credentials',
}

// authentication providers
export interface IAuthProvider {
  provider: AuthProvider;
  providerId: string;
}

export enum IsActive {
  ACTIVE = 'ACTIVE',
  INACTIVE = 'INACTIVE',
  BLOCKED = 'BLOCKED',
}

export interface IUser {
  _id?: Types.ObjectId;

  name: string;
  email: string;
  password?: string;

  phone?: string;
  picture?: string;
  address?: string;

  role: Role;

  skills?: string[];
  experience?: number;
  resume?: string;

  appliedJobs?: Types.ObjectId[];

  isDeleted?: boolean;
  isActive?: IsActive;
  isVerified?: boolean;

  auths: IAuthProvider[];

  createdAt?: Date;
  updatedAt?: Date;
}

export interface IUserMethods {
  comparePassword(password: string): Promise<boolean>;
}

export interface IUserModel extends Model<IUser, {}, IUserMethods> {
  findUserById(id: string): Promise<IUser | null>;

  isUserExists(id: string): Promise<boolean>;

  findUserByEmail(email: string): Promise<(IUser & IUserMethods) | null>;
}
