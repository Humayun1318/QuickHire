import request from 'supertest';
import mongoose from 'mongoose';
import app from '../src/app';
import { connectDB, disconnectDB } from '../src/app/config/db';

export const api = () => request(app);

export const SUPER_ADMIN = {
  email: 'superadmin@test.com',
  password: 'SuperAdmin1!',
};

export const PASSWORD = 'Passw0rd!';

/**
 * Connects (which also seeds the super admin) and makes sure all indexes —
 * including the text and unique indexes the tests rely on — are built.
 */
export const setupDatabase = async () => {
  await connectDB();
  await Promise.all(
    Object.values(mongoose.models).map((model) => model.syncIndexes()),
  );
};

export const teardownDatabase = async () => {
  await mongoose.connection.dropDatabase();
  await disconnectDB();
};

let counter = 0;
export const uniqueEmail = (prefix: string) =>
  `${prefix}${Date.now()}${counter++}@test.com`;

export const register = async (
  role: 'seeker' | 'employer',
  overrides: Record<string, unknown> = {},
) => {
  const email = uniqueEmail(role);
  const res = await api()
    .post('/api/v1/auth/register')
    .send({
      name: `Test ${role}`,
      email,
      password: PASSWORD,
      role,
      ...overrides,
    });
  if (res.status !== 201) {
    throw new Error(
      `register failed: ${res.status} ${JSON.stringify(res.body)}`,
    );
  }
  return { email, user: res.body.data };
};

export const login = async (email: string, password = PASSWORD) => {
  const res = await api().post('/api/v1/auth/login').send({ email, password });
  if (res.status !== 200) {
    throw new Error(`login failed: ${res.status} ${JSON.stringify(res.body)}`);
  }
  return res.body.data.accessToken as string;
};

export const createUser = async (role: 'seeker' | 'employer') => {
  const { email, user } = await register(role);
  const token = await login(email);
  return { email, token, id: user._id as string };
};

export const loginSuperAdmin = () =>
  login(SUPER_ADMIN.email, SUPER_ADMIN.password);

export const auth = (token: string) => ({ Authorization: `Bearer ${token}` });

export const createCompany = async (token: string, name = 'Acme Corp') => {
  const res = await api()
    .post('/api/v1/companies')
    .set(auth(token))
    .send({ name, industry: 'Technology', website: 'https://acme.test' });
  if (res.status !== 201) {
    throw new Error(
      `company failed: ${res.status} ${JSON.stringify(res.body)}`,
    );
  }
  return res.body.data._id as string;
};

export const jobPayload = (companyId: string, overrides = {}) => ({
  companyId,
  title: 'Senior Node Developer',
  description:
    'We are looking for an experienced backend developer to lead our platform engineering effort.',
  type: 'full-time',
  workMode: 'remote',
  experienceLevel: 'senior',
  location: { city: 'Dhaka', country: 'Bangladesh' },
  salary: { min: 80000, max: 120000, currency: 'BDT' },
  skills: ['Node.js', 'MongoDB'],
  status: 'published',
  ...overrides,
});

export const createJob = async (
  token: string,
  companyId: string,
  overrides = {},
) => {
  const res = await api()
    .post('/api/v1/jobs')
    .set(auth(token))
    .send(jobPayload(companyId, overrides));
  if (res.status !== 201) {
    throw new Error(`job failed: ${res.status} ${JSON.stringify(res.body)}`);
  }
  return res.body.data;
};
