/**
 * @file env.ts
 * @description Environment variable configuration and validation
 * This file loads, validates, and exports all required environment variables
 * Ensures all critical configuration is present before the application starts
 */

import dotenv from 'dotenv';

// Load environment variables from .env file into process.env
dotenv.config();

/**
 * Interface defining the structure of all environment variables
 * This ensures type safety when accessing environment variables throughout the application
 */
interface EnvConfig {
  // Server Configuration
  PORT: string;
  NODE_ENV: 'development' | 'production';

  // Database Configuration
  DB_URL: string;

  // Frontend Configuration
  FRONTEND_URL: string;

  // Security & Encryption
  BCRYPT_SALT_ROUND: string;
  EXPRESS_SESSION_SECRET: string;

  // JWT (JSON Web Token) Configuration
  JWT_ACCESS_SECRET: string; // Secret key for signing access tokens
  JWT_ACCESS_EXPIRES: string; // Expiration time for access tokens
  JWT_REFRESH_SECRET: string; // Secret key for signing refresh tokens
  JWT_REFRESH_EXPIRES: string; // Expiration time for refresh tokens

  // Super Admin User Credentials
  SUPER_ADMIN_EMAIL: string;
  SUPER_ADMIN_PASSWORD: string;

  // Google OAuth Configuration
  GOOGLE_CLIENT_ID: string;
  GOOGLE_CLIENT_SECRET: string;
  GOOGLE_CALLBACK_URL: string;
}

/**
 * Function to validate and load environment variables
 * Process:
 * 1. Defines list of required environment variables
 * 2. Checks if each required variable exists in process.env
 * 3. Throws error if any required variable is missing
 * 4. Returns typed configuration object with all variables
 *
 * @throws Error if any required environment variable is missing
 * @returns {EnvConfig} Validated environment configuration object
 */
const loadEnvVariables = (): EnvConfig => {
  // List of all required environment variables that must be present
  const requiredEnvVariables: string[] = [
    'PORT',
    'DB_URL',
    'NODE_ENV',
    'FRONTEND_URL',
    'BCRYPT_SALT_ROUND',
    'JWT_ACCESS_SECRET',
    'JWT_ACCESS_EXPIRES',
    'JWT_REFRESH_SECRET',
    'JWT_REFRESH_EXPIRES',
    'SUPER_ADMIN_EMAIL',
    'SUPER_ADMIN_PASSWORD',
    'EXPRESS_SESSION_SECRET',
    'GOOGLE_CLIENT_SECRET',
    'GOOGLE_CLIENT_ID',
    'GOOGLE_CALLBACK_URL',
  ];

  /**
   * Validation loop: Check if each required variable exists
   * Throws an error immediately if any variable is missing
   * This fails fast to prevent runtime errors due to missing configuration
   */
  requiredEnvVariables.forEach((key) => {
    if (!process.env[key]) {
      throw new Error(`Missing required environment variable: ${key}`);
    }
  });

  // Return validated configuration object with all environment variables properly typed
  return {
    PORT: process.env.PORT as string,
    DB_URL: process.env.DB_URL as string,
    NODE_ENV: process.env.NODE_ENV as 'development' | 'production',
    FRONTEND_URL: process.env.FRONTEND_URL as string,
    BCRYPT_SALT_ROUND: process.env.BCRYPT_SALT_ROUND as string,
    JWT_ACCESS_SECRET: process.env.JWT_ACCESS_SECRET as string,
    JWT_ACCESS_EXPIRES: process.env.JWT_ACCESS_EXPIRES as string,
    JWT_REFRESH_SECRET: process.env.JWT_REFRESH_SECRET as string,
    JWT_REFRESH_EXPIRES: process.env.JWT_REFRESH_EXPIRES as string,
    SUPER_ADMIN_EMAIL: process.env.SUPER_ADMIN_EMAIL as string,
    SUPER_ADMIN_PASSWORD: process.env.SUPER_ADMIN_PASSWORD as string,
    EXPRESS_SESSION_SECRET: process.env.EXPRESS_SESSION_SECRET as string,
    GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET as string,
    GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID as string,
    GOOGLE_CALLBACK_URL: process.env.GOOGLE_CALLBACK_URL as string,
  };
};

// Load and export the validated environment variables
// This is executed immediately when the module is imported
export const envVars = loadEnvVariables();
