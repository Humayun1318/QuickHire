import { Model, Types, Document } from 'mongoose';

// Enums for user roles
export enum UserRole {
  SUPER_ADMIN = 'super_admin',
  ADMIN       = 'admin',
  SEEKER      = 'seeker',
  EMPLOYER    = 'employer',
}

// authProvider types
export enum AuthProvider {
  LOCAL  = 'local', 
  GOOGLE = 'google',  
}

// authentication providers
export interface IAuthEntry {
  provider:   AuthProvider;
  providerId: string;
}

export enum AccountStatus {
  ACTIVE    = 'active',     // সব কিছু ঠিক আছে, login করতে পারবে
  INACTIVE  = 'inactive',   // account deactivated (soft-delete equivalent)
  SUSPENDED = 'suspended',  // temporarily blocked, admin review pending
  BANNED    = 'banned',     // permanently blocked
}

export interface IUser extends Document {
  // ── Core Identity ────────────────────────────────
  name:     string;
  email:    string;
 
  password?: string;
 
  avatar?: string;
  phone?: string;
 
  // ── Role & Auth ──────────────────────────────────
  role: UserRole;

  auths: IAuthEntry[];
 
  // ── Account Lifecycle ────────────────────────────
  status:     AccountStatus;
  isVerified: boolean;
  lastLogin?: Date;
 
  // ── Cross-module FK References ───────────────────
  seekerProfileId?: Types.ObjectId;
  companyId?:       Types.ObjectId;
  subscriptionId?:  Types.ObjectId;
 
  // ── Timestamps (Mongoose auto-manages) ───────────
  createdAt?: Date;
  updatedAt?: Date;
}
 
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// INSTANCE METHODS INTERFACE
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 
export interface IUserMethods {

  comparePassword(candidatePassword: string): Promise<boolean>;
 
  isAccountActive(): boolean;
  hasAuthProvider(provider: AuthProvider): boolean;
}
 
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// STATIC METHODS INTERFACE (Model-level)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export interface IUserModel extends Model<IUser, {}, IUserMethods> {

  // findByEmail — email দিয়ে user খোঁজে, password সহ (login এর জন্য)।
  findByEmail(email: string): Promise<(IUser & IUserMethods) | null>;
 
  // findByGoogleId — Google auth provider এর providerId (Google ID) দিয়ে user খোঁজে।
  findByGoogleId(googleId: string): Promise<(IUser & IUserMethods) | null>;

  existsById(id: string): Promise<boolean>;
}
