import dotenv from 'dotenv';

dotenv.config();

interface EnvConfig {
  PORT: string;
  DB_URL: string;
  NODE_ENV: 'development' | 'production';
  FRONTEND_URL: string;
}

const loadEnvVariables = (): EnvConfig => {
  const requiredEnvVariables: string[] = [
    'PORT',
    'DB_URL',
    'NODE_ENV',
    'FRONTEND_URL',
  ];

  requiredEnvVariables.forEach((key) => {
    if (!process.env[key]) {
      throw new Error(`Missing required environment variable: ${key}`);
    }
  });

  return {
    PORT: process.env.PORT as string,
    DB_URL: process.env.DB_URL!,
    NODE_ENV: process.env.NODE_ENV as 'development' | 'production',
    FRONTEND_URL: process.env.FRONTEND_URL!,
  };
};

export const envVars = loadEnvVariables();
