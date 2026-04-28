import { Schema, model } from 'mongoose';
import bcrypt from 'bcrypt';
import { envVars } from '../../config/env';
import {
  IUser,
  IUserModel,
  IUserMethods,
  AuthProvider,
  AccountStatus,
  UserRole,
} from './user.interface';

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// AUTH ENTRY SUB-SCHEMA
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

const authEntrySchema = new Schema(
  {
    provider: {
      type:     String,
      enum:     Object.values(AuthProvider),
      required: [true, 'Auth provider is required'],
    },
    providerId: {
      type:     String,
      required: [true, 'Provider ID is required'],
      trim:     true,
    },
  },
  { _id: false, versionKey: false },
);

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// USER SCHEMA
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

const userSchema = new Schema<IUser, IUserModel, IUserMethods>(
  {
    // ── Core Identity ──────────────────────────────
    name: {
      type:     String,
      required: [true, 'Name is required'],
      trim:     true,
      minlength: [2, 'Name must be at least 2 characters'],
      maxlength: [50, 'Name cannot exceed 50 characters'],
    },

    email: {
      type:      String,
      required:  [true, 'Email is required'],
      unique:    true,   // unique: true automatically creates an index
      lowercase: true,
      trim:      true,
    },

    password: {
      type:   String,
      select: false,
    },

    avatar: {
      type:    String,
      default: null,
    },

    phone: {
      type:    String,
      trim:    true,
      default: null,
    },

    // ── Role ──────────────────────────────────────
    role: {
      type:    String,
      enum:    Object.values(UserRole),
      default: UserRole.SEEKER,

      /**
       * index: true কারণ এই field এ প্রায়ই filter হবে:
       *   User.find({ role: 'employer' })  → admin dashboard
       *   User.find({ role: 'seeker' })    → recruiter search
       * Index ছাড়া এই queries full collection scan করবে।
       */
      index: true,
    },

    auths: {
      type:    [authEntrySchema],
      required: [true, 'At least one auth provider is required'],
    },

    // ── Account Lifecycle ──────────────────────────
    /**
     * index: true → অনেক query তে status filter থাকে:
     *   - Auth middleware: { status: 'active' }
     *   - Admin panel: { status: 'suspended' }
     *   - Cleanup job: { status: 'inactive' }
     */
    status: {
      type:    String,
      enum:    Object.values(AccountStatus),
      default: AccountStatus.ACTIVE,
      index:   true,
    },

    isVerified: {
      type:    Boolean,
      default: false,
    },

    lastLogin: {
      type:    Date,
      default: null,
    },

    // ── FK References ──────────────────────────────
    seekerProfileId: {
      type:    Schema.Types.ObjectId,
      ref:     'SeekerProfile',
      default: null,
    },

    companyId: {
      type:    Schema.Types.ObjectId,
      ref:     'Company',
      default: null,
    },

    subscriptionId: {
      type:    Schema.Types.ObjectId,
      ref:     'Subscription',
      default: null,
    },
  },
  {
    timestamps: true,
    versionKey: false, 

    /**
     * toJSON transform:
     *
     * তোমার original code এ এটা ছিল — রাখা হয়েছে।
     * এটা "safety net" হিসেবে কাজ করে।
     *
     * select: false password কে query থেকে বাদ দেয়।
     * কিন্তু যদি কোনোভাবে password loaded থাকে এবং
     * res.json(user) করা হয় — এই transform সেটা delete করে।
     *
     * Defense in depth: দুটো আলাদা layer এ protection।
     */
    toJSON: {
      transform: (_doc, ret) => {
        delete ret.password;
        return ret;
      },
    },
    toObject: {
      transform: (_doc, ret) => {
        delete ret.password;
        return ret;
      },
    },
  },
);

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// INDEXES
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
/**
 * Compound index on auths array — Google OAuth lookup কে fast করে।
 *
 * কেন schema definition এর বাইরে?
 *   Schema এর ভেতরে array field এ compound index define করা যায় না।
 *   তাই schema.index() দিয়ে আলাদাভাবে করতে হয়।
 *
 * এই index support করে:
 *   findByGoogleId() → { auths.provider: 'google', auths.providerId: X }
 *   hasAuthProvider() → memory তে করা হয় (DB query না), তাই index লাগে না।
 */
userSchema.index({ 'auths.provider': 1, 'auths.providerId': 1 });

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// PRE-SAVE HOOKS
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━


userSchema.pre('save', async function (next) {
  if (!this.password || !this.isModified('password')) return next();

  this.password = await bcrypt.hash(
    this.password,
    Number(envVars.BCRYPT_SALT_ROUND),
  );

  next();
});

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  INSTANCE METHODS
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━


userSchema.methods.comparePassword = function (
  this: IUser,
  candidatePassword: string,
): Promise<boolean> {
  if (!this.password) return Promise.resolve(false);
  return bcrypt.compare(candidatePassword, this.password);
};

userSchema.methods.isAccountActive = function (this: IUser): boolean {
  return this.status === AccountStatus.ACTIVE;
};

/**
 *   user.hasAuthProvider(AuthProvider.LOCAL)  → password আছে কিনা
 *   user.hasAuthProvider(AuthProvider.GOOGLE) → Google linked কিনা
 */
userSchema.methods.hasAuthProvider = function (
  this: IUser,
  provider: AuthProvider,
): boolean {
  return this.auths.some((entry) => entry.provider === provider);
};

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// STATIC METHODS
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

userSchema.statics.findByEmail = function (email: string) {
  return this.findOne({ email }).select('+password');
};

/**
 
 * কেন $elemMatch? কেন না { 'auths.provider': 'google', 'auths.providerId': id }?
 *
 * পার্থক্য (important!):
 *   Without $elemMatch:
 *     MongoDB আলাদাভাবে check করে:
 *     "কোনো element এ provider='google' আছে?" AND "কোনো element এ providerId=X আছে?"
 *     এই দুটো condition আলাদা array elements এ থাকলেও match হবে → false positive bug!
 *
 *   With $elemMatch:
 *     "একই element এ provider='google' AND providerId=X উভয়ই আছে?"
 *     এটা safe and precise।
 *
 * Google OAuth callback এ use:
 *   const user = await User.findByGoogleId(profile.id);
 *   if (!user) { // নতুন user create করো }
 *   else { // existing user, token দাও }
 */
userSchema.statics.findByGoogleId = function (googleId: string) {
  return this.findOne({
    auths: {
      $elemMatch: {
        provider:   AuthProvider.GOOGLE,
        providerId: googleId,
      },
    },
  });
};


userSchema.statics.existsById = async function (id: string): Promise<boolean> {
  return !!(await this.exists({ _id: id }));
};

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// MODEL EXPORT
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export const User = model<IUser, IUserModel>('User', userSchema);