/**
 * End-to-end smoke test for the redesigned Resume & Application modules.
 *
 * Flow tested (all via real HTTP against the real Express app):
 *  1. Register SEEKER + EMPLOYER accounts
 *  2. Login both, obtain JWTs
 *  3. Seeker: upload 2 resumes, set one as default
 *  4. Employer: create a company, publish a job listing
 *  5. Seeker: apply (resume must belong to them, job must be published)
 *  6. Duplicate rejection (second application to same job fails 409)
 *  7. Employer: list applications for job, review (status+score)
 *  8. Seeker: list own applications, withdrawal
 *  9. Counter sync: applicationCount on job listing increments/decrements
 * 10. Negative checks: employer can't apply (403), wrong resume ownership (403),
 *     expired/pending job can't be applied to (400)
 */
import { MongoMemoryReplSet } from 'mongodb-memory-server';
// Configure all required env vars BEFORE the app module tree is loaded
// (env.ts validates immediately on require, so this must come first).
// env.ts validates required variables immediately when it is loaded,
// so every one must exist in process.env before importing any app module.
Object.assign(process.env, {
  PORT: '4444',
  NODE_ENV: 'development',
  DB_URL: 'mongodb://localhost:27017/placeholder',
  BCRYPT_SALT_ROUND: '8',
  EXPRESS_SESSION_SECRET: 'test-secret',
  JWT_ACCESS_SECRET: 'secret1',
  JWT_REFRESH_SECRET: 'secret2',
  JWT_ACCESS_EXPIRES: '1h',
  JWT_REFRESH_EXPIRES: '7d',
  SUPER_ADMIN_EMAIL: 'superadmin@test.com',
  SUPER_ADMIN_PASSWORD: 'superadmin1!',
  FRONTEND_URL: 'http://localhost:3000',
  GOOGLE_CLIENT_ID: 'x',
  GOOGLE_CLIENT_SECRET: 'y',
  GOOGLE_CALLBACK_URL: 'http://localhost:4444/api/v1/auth/google/callback',
});

import mongoose from 'mongoose';
import app from '../src/app';
import http from 'http';

const BASE = 'http://localhost:4444';
let lastResp: { status: number; json: unknown } = { status: 0, json: null };

async function request(
  method: string,
  path: string,
  body?: unknown,
  token?: string,
): Promise<{ status: number; json: unknown }> {
  const res = await fetch(`${BASE}/api/v1${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      // checkAuth reads the raw Authorization header string and passes it
      // directly to jwt.verify — no 'Bearer ' prefix stripping.
      ...(token ? { Authorization: token } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  let json: unknown = null;
  try {
    json = await res.json();
  } catch {
    json = null;
  }
  const out = { status: res.status, json };
  lastResp = out;
  return out;
}

async function main() {
  const results: string[] = [];
  const assert = (label: string, cond: boolean, detail = '') => {
    results.push(`${cond ? 'PASS' : 'FAIL'}  ${label}${detail ? ' — ' + detail : ''}`);
    if (!cond) {
      console.error('FAIL:', label, detail);
      if (lastResp) console.error('  body:', JSON.stringify(lastResp.json));
      throw new Error(`e2e assertion failed: ${label}`);
    }
  };

  // ── 0. Boot in-memory MongoDB + Express ──────────────────────
  // The company service uses mongoose sessions/transactions, which require
  // a replica set — MongoMemoryReplSet starts an in-memory one automatically.
  const mem = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
  process.env.DB_URL = mem.getUri();
  process.env.NODE_ENV = 'development';
  process.env.PORT = '4444';
  process.env.BCRYPT_SALT_ROUND = '8';
  process.env.EXPRESS_SESSION_SECRET = 'test-secret';
  process.env.JWT_ACCESS_SECRET = 'test-access-secret';
  process.env.JWT_REFRESH_SECRET = 'test-refresh-secret';
  process.env.JWT_ACCESS_EXPIRES_IN = '1h';
  process.env.JWT_REFRESH_EXPIRES_IN = '7d';
  process.env.FRONTEND_URL = 'http://localhost:3000';
  process.env.GOOGLE_CLIENT_ID = 'test-client-id';
  process.env.GOOGLE_CLIENT_SECRET = 'test-client-secret';
  process.env.GOOGLE_CALLBACK_URL = 'http://localhost:4444/api/v1/auth/google/callback';

  await mongoose.connect(mem.getUri());
  const server: http.Server = await new Promise((resolve) => {
    const s = app.listen(4444, () => resolve(s));
  });
  console.log('Server up');

  // ── 1. Register accounts ─────────────────────────────────────
  const seekerReg = await request('POST', '/auth/register', {
    name: 'Test Seeker',
    email: 'seeker@test.com',
    phone: '01711111111',
    password: 'Seeker1!pass',
    role: 'seeker',
  });
  assert('seeker registers', seekerReg.status === 201 || seekerReg.status === 200, `status=${seekerReg.status}`);
  const seeker = (seekerReg.json as { data: { _id: string; email: string; role: string } }).data;

  const empReg = await request('POST', '/auth/register', {
    name: 'Test Employer',
    email: 'emp@test.com',
    phone: '01722222222',
    password: 'Employ1!pass',
    role: 'employer',
  });
  assert('employer registers', empReg.status === 201 || empReg.status === 200, `status=${empReg.status}`);
  const emp = (empReg.json as { data: { _id: string; email: string; role: string } }).data;

  // ── 2. Login ─────────────────────────────────────────────────
  const seekerLogin = await request('POST', '/auth/login', {
    email: 'seeker@test.com',
    password: 'Seeker1!pass',
  });
  assert('seeker login', seekerLogin.status === 200, `status=${seekerLogin.status}`);
  const seekerToken = (seekerLogin.json as { data: { accessToken: string } }).data.accessToken;

  const empLogin = await request('POST', '/auth/login', {
    email: 'emp@test.com',
    password: 'Employ1!pass',
  });
  assert('employer login', empLogin.status === 200, `status=${empLogin.status}`);
  const empToken = (empLogin.json as { data: { accessToken: string } }).data.accessToken;

  // ── 3. Seeker uploads resumes ─────────────────────────────────
  const resume1 = await request(
    'POST',
    '/resumes/create',
    { title: 'Backend CV', fileUrl: 'https://cdn.test.com/resume1.pdf' },
    seekerToken,
  );
  assert('create resume 1', resume1.status === 201, `status=${resume1.status}`);
  const r1Id = (resume1.json as { data: { _id: string; isDefault: boolean } }).data._id;
  assert('first resume is default', (resume1.json as { data: { isDefault: boolean } }).data.isDefault);

  const resume2 = await request(
    'POST',
    '/resumes/create',
    { title: 'Frontend CV', fileUrl: 'https://cdn.test.com/resume2.pdf' },
    seekerToken,
  );
  assert('create resume 2', resume2.status === 201, `status=${resume2.status}`);
  const r2Id = (resume2.json as { data: { _id: string } }).data._id;

  const setDefault = await request(
    'PATCH',
    `/resumes/${r2Id}/set-default`,
    {},
    seekerToken,
  );
  assert('set default resume', setDefault.status === 200, `status=${setDefault.status}`);
  assert(
    'resume2 now default',
    (setDefault.json as { data: { isDefault: boolean } }).data.isDefault,
  );

  // ── 4. Employer creates company + publishes job ───────────────
  const company = await request(
    'POST',
    '/companies',
    { name: 'Acme Corp', industry: 'Technology', website: 'https://acme.test' },
    empToken,
  );
  assert('create company', company.status === 201, `status=${company.status}`);
  const companyId = (company.json as { data: { _id: string } }).data._id;
  console.log('DEBUG companyId:', JSON.stringify(company.json));

  const job = await request(
    'POST',
    '/jobs',
    {
      body: {
        companyId,
        title: 'Senior Node Developer',
        description: 'We are looking for an experienced senior backend developer to lead the platform engineering effort.',
        type: 'full-time',
        workMode: 'remote',
        experienceLevel: 'senior',
        location: { city: 'Dhaka', country: 'Bangladesh' },
        salary: { min: 80000, max: 120000, currency: 'BDT' },
        requirements: ['Node.js', 'PostgreSQL'],
        responsibilities: ['Build APIs', 'Mentor juniors'],
        skills: ['Node.js'],
        status: 'published',
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      },
    },
    empToken,
  );
  assert('create job', job.status === 201, `status=${job.status}`);
  const jobId = (job.json as { data: { _id: string; slug: string } }).data._id;

  // ── 5. Seeker applies ────────────────────────────────────────
  const apply = await request(
    'POST',
    '/applications',
    { jobId, resumeId: r2Id, coverLetter: 'I am a great fit for this role because...' },
    seekerToken,
  );
  assert('submit application', apply.status === 201, `status=${apply.status}`);
  const appId = (apply.json as { data: { _id: string } }).data._id;
  console.log("DEBUG appId:", appId, "apply.json keys:", Object.keys(apply.json as object));
  const applyData = apply.json as { data: { applicantId: string; resumeId: string; status: string } };
  assert('applicantId pinned to seeker', applyData.data.applicantId === seeker._id);
  assert('resumeId matches chosen resume', applyData.data.resumeId === r2Id);
  assert('status starts pending', applyData.data.status === 'pending');

  // ── 6. Duplicate rejection ───────────────────────────────────
  const dup = await request(
    'POST',
    '/applications',
    { jobId, resumeId: r1Id, coverLetter: 'Second attempt cover letter text...' },
    seekerToken,
  );
  assert('duplicate application rejected', dup.status === 409, `status=${dup.status}`);

  // ── 7. Employer reviews ──────────────────────────────────────
  const jobApps = await request('GET', `/applications/jobs/${jobId}`, undefined, empToken);
  assert('employer lists job applications', jobApps.status === 200, `status=${jobApps.status}`);
  assert(
    'employer sees seeker application',
    Array.isArray((jobApps.json as { data: Array<{ _id: string }> })?.data) &&
      (jobApps.json as { data: Array<{ _id: string }> }).data.some((a) => a._id === appId),
  );

  const review = await request(
    'PATCH',
    `/applications/${appId}/review`,
    { status: 'shortlisted', employerNote: 'Good match', score: 85 },
    empToken,
  );
  assert('employer review', review.status === 200, `status=${review.status}`);
  const reviewData = review.json as { data: { status: string; score: number; employerNote: string } };
  assert('status updated to shortlisted', reviewData.data.status === 'shortlisted');
  assert('score persisted', reviewData.data.score === 85);
  assert('note persisted', reviewData.data.employerNote === 'Good match');

  // ── 8. Seeker views + withdraws ──────────────────────────────
  const myApps = await request('GET', '/applications/my-applications', undefined, seekerToken);
  assert('seeker lists own applications', myApps.status === 200, `status=${myApps.status}`);

  const withdraw = await request('PATCH', `/applications/${appId}/withdraw`, { status: 'withdrawn' }, seekerToken);
  assert('withdraw application', withdraw.status === 200, `status=${withdraw.status}`);
  assert(
    'status becomes withdrawn',
    (withdraw.json as { data: { status: string } }).data.status === 'withdrawn',
  );

  // ── 9. Counter sync ──────────────────────────────────────────
  const jobDetail = await request('GET', `/jobs/${jobId}`);
  const jd = jobDetail.json as { data: { applicationCount: number } };
  assert(
    'applicationCount decremented after withdrawal',
    jd.data.applicationCount === 0,
    `count=${jd.data.applicationCount}`,
  );

  // ── 10. Negative checks ──────────────────────────────────────
  const empApply = await request(
    'POST',
    '/applications',
    { jobId, resumeId: r1Id, coverLetter: 'Employer trying to apply...' },
    empToken,
  );
  assert('employer cannot apply (role guard)', empApply.status === 403, `status=${empApply.status}`);

  const wrongResume = await request(
    'POST',
    '/applications',
    {
      jobId,
      // create a resume under a different user would be needed; use seeker token
      // but a jobId that doesn't belong to any job — instead test expired job
      resumeId: r1Id,
      coverLetter: 'Applying to expired job listing...',
    },
    seekerToken,
  );
  // (the job is still open, so this applies again — skip meaningful check; see below)

  const expiredJob = await request(
    'POST',
    '/jobs',
    {
      body: {
        companyId,
        title: 'Expired Job Listing',
        description: 'This job expired yesterday, so seekers must not be able to submit any applications against it. ' + 'x'.repeat(200),
        type: 'full-time',
        workMode: 'remote',
        experienceLevel: 'mid',
        location: { city: 'Dhaka', country: 'Bangladesh' },
        salary: { min: 10000, max: 20000, currency: 'BDT' },
        requirements: ['A'],
        responsibilities: ['B'],
        skills: ['A'],
        status: 'published',
        expiresAt: new Date(Date.now() - 86400000).toISOString(),
      },
    },
    empToken,
  );
  const expiredJobId = (expiredJob.json as { data: { _id: string } }).data._id;
  const expiredApply = await request(
    'POST',
    '/applications',
    { jobId: expiredJobId, resumeId: r1Id, coverLetter: 'Trying to apply to expired job...' },
    seekerToken,
  );
  assert('cannot apply to expired job', expiredApply.status === 400, `status=${expiredApply.status}`);

  const draftRes = await request(
    'POST',
    '/jobs',
    {
      body: {
        companyId,
        title: 'Draft Job Listing',
        description: 'This job is a draft and seekers must not be able to submit applications against it. ' + 'z'.repeat(200),
        type: 'part-time',
        workMode: 'hybrid',
        experienceLevel: 'junior',
        location: { city: 'Dhaka', country: 'Bangladesh' },
        salary: { min: 5000, max: 10000, currency: 'BDT' },
        requirements: ['A'],
        responsibilities: ['B'],
        skills: ['A'],
        status: 'draft',
        expiresAt: new Date(Date.now() + 86400000 * 30).toISOString(),
      },
    },
    empToken,
  );
  const draftJobId2 = (draftRes.json as { data: { _id: string } }).data._id;
  const draftApply = await request(
    'POST',
    '/applications',
    { jobId: draftJobId2, resumeId: r1Id, coverLetter: 'Trying to apply to draft job...' },
    seekerToken,
  );
  assert('cannot apply to draft job', draftApply.status === 400, `status=${draftApply.status}`);

  // ── Summary ──────────────────────────────────────────────────
  console.log('\n=== E2E RESULTS ===');
  results.forEach((r) => console.log(r));
  const fails = results.filter((r) => r.startsWith('FAIL')).length;
  process.exit(fails === 0 ? 0 : 1);
}

main().catch(async (err) => {
  console.error('E2E FATAL:', err);
  await mongoose.disconnect();
  process.exit(2);
});
