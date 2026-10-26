import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  api,
  auth,
  createCompany,
  createJob,
  createUser,
  loginSuperAdmin,
  setupDatabase,
  teardownDatabase,
} from './helpers';
import { JobListing } from '../src/app/modules/jobListing/jobListing.models';

beforeAll(setupDatabase);
afterAll(teardownDatabase);

const COVER = 'I am a great fit for this role because of my experience.';

const createResume = async (token: string, title: string) => {
  const res = await api()
    .post('/api/v1/resumes/create')
    .set(auth(token))
    .send({
      title,
      fileUrl: `https://cdn.test/${encodeURIComponent(title)}.pdf`,
    });
  expect(res.status).toBe(201);
  return res.body.data;
};

describe('resumes', () => {
  it('first resume is default; default can be switched; ownership enforced', async () => {
    const seeker = await createUser('seeker');
    const first = await createResume(seeker.token, 'Backend CV');
    const second = await createResume(seeker.token, 'Frontend CV');
    expect(first.isDefault).toBe(true);
    expect(second.isDefault).toBe(false);

    const setDefault = await api()
      .patch(`/api/v1/resumes/${second._id}/set-default`)
      .set(auth(seeker.token));
    expect(setDefault.body.data.isDefault).toBe(true);

    const list = await api().get('/api/v1/resumes').set(auth(seeker.token));
    expect(list.body.data[0]._id).toBe(second._id);
    expect(
      list.body.data.filter((r: { isDefault: boolean }) => r.isDefault),
    ).toHaveLength(1);

    const other = await createUser('seeker');
    const foreign = await api()
      .get(`/api/v1/resumes/${first._id}`)
      .set(auth(other.token));
    expect(foreign.status).toBe(404);
  });

  it('cannot delete the last resume; deleting the default promotes another', async () => {
    const seeker = await createUser('seeker');
    const only = await createResume(seeker.token, 'Only CV');
    const lastDelete = await api()
      .delete(`/api/v1/resumes/${only._id}`)
      .set(auth(seeker.token));
    expect(lastDelete.status).toBe(400);

    await createResume(seeker.token, 'Second CV');
    const del = await api()
      .delete(`/api/v1/resumes/${only._id}`)
      .set(auth(seeker.token));
    expect(del.status).toBe(200);
    const list = await api().get('/api/v1/resumes').set(auth(seeker.token));
    expect(list.body.data).toHaveLength(1);
    expect(list.body.data[0].isDefault).toBe(true);
  });

  it('rejects non-http(s) file URLs', async () => {
    const seeker = await createUser('seeker');
    const res = await api()
      .post('/api/v1/resumes/create')
      .set(auth(seeker.token))
      .send({ title: 'Evil', fileUrl: 'javascript:alert(1)' });
    expect(res.status).toBe(400);
  });
});

describe('applications', () => {
  let seeker: Awaited<ReturnType<typeof createUser>>;
  let employer: Awaited<ReturnType<typeof createUser>>;
  let companyId: string;
  let jobId: string;
  let resumeId: string;
  let applicationId: string;

  beforeAll(async () => {
    seeker = await createUser('seeker');
    employer = await createUser('employer');
    companyId = await createCompany(employer.token);
    jobId = (await createJob(employer.token, companyId))._id;
    resumeId = (await createResume(seeker.token, 'Main CV'))._id;
  });

  it('seeker applies to a published job', async () => {
    const res = await api()
      .post('/api/v1/applications')
      .set(auth(seeker.token))
      .send({ jobId, resumeId, coverLetter: COVER });

    expect(res.status).toBe(201);
    expect(res.body.data).toMatchObject({
      applicantId: seeker.id,
      resumeId,
      status: 'pending',
    });
    applicationId = res.body.data._id;

    const job = await JobListing.findById(jobId).lean();
    expect(job?.applicationCount).toBe(1);
  });

  it('rejects a duplicate application with 409', async () => {
    const res = await api()
      .post('/api/v1/applications')
      .set(auth(seeker.token))
      .send({ jobId, resumeId, coverLetter: COVER });
    expect(res.status).toBe(409);
  });

  it("rejects applying with someone else's resume", async () => {
    const other = await createUser('seeker');
    const res = await api()
      .post('/api/v1/applications')
      .set(auth(other.token))
      .send({ jobId, resumeId, coverLetter: COVER });
    expect(res.status).toBe(403);
  });

  it('employers cannot apply', async () => {
    const res = await api()
      .post('/api/v1/applications')
      .set(auth(employer.token))
      .send({ jobId, resumeId, coverLetter: COVER });
    expect(res.status).toBe(403);
  });

  it('cannot apply to draft or expired jobs', async () => {
    const other = await createUser('seeker');
    const otherResume = (await createResume(other.token, 'CV'))._id;

    const draft = await createJob(employer.token, companyId, {
      status: 'draft',
    });
    const draftRes = await api()
      .post('/api/v1/applications')
      .set(auth(other.token))
      .send({ jobId: draft._id, resumeId: otherResume, coverLetter: COVER });
    expect(draftRes.status).toBe(400);

    const expired = await createJob(employer.token, companyId);
    await JobListing.updateOne(
      { _id: expired._id },
      { expiresAt: new Date(Date.now() - 1000) },
    );
    const expiredRes = await api()
      .post('/api/v1/applications')
      .set(auth(other.token))
      .send({ jobId: expired._id, resumeId: otherResume, coverLetter: COVER });
    expect(expiredRes.status).toBe(400);
  });

  it('only managers of the owning company can list and review applications', async () => {
    const outsider = await createUser('employer');
    await createCompany(outsider.token, 'Outsider Co');

    const denied = await api()
      .get(`/api/v1/applications/jobs/${jobId}`)
      .set(auth(outsider.token));
    expect(denied.status).toBe(403);

    const deniedReview = await api()
      .patch(`/api/v1/applications/${applicationId}/review`)
      .set(auth(outsider.token))
      .send({ status: 'rejected' });
    expect(deniedReview.status).toBe(403);

    const list = await api()
      .get(`/api/v1/applications/jobs/${jobId}`)
      .set(auth(employer.token));
    expect(list.status).toBe(200);
    expect(list.body.data.map((a: { _id: string }) => a._id)).toContain(
      applicationId,
    );
  });

  it('employer reviews status, note and score', async () => {
    const res = await api()
      .patch(`/api/v1/applications/${applicationId}/review`)
      .set(auth(employer.token))
      .send({ status: 'shortlisted', employerNote: 'Good match', score: 85 });

    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({
      status: 'shortlisted',
      employerNote: 'Good match',
      score: 85,
    });
  });

  it('employer cannot set the applicant-only "withdrawn" status', async () => {
    const res = await api()
      .patch(`/api/v1/applications/${applicationId}/review`)
      .set(auth(employer.token))
      .send({ status: 'withdrawn' });
    expect(res.status).toBe(400);
  });

  it('seeker lists own applications and withdraws', async () => {
    const mine = await api()
      .get('/api/v1/applications/my-applications')
      .set(auth(seeker.token));
    expect(mine.status).toBe(200);
    expect(mine.body.data).toHaveLength(1);

    const withdraw = await api()
      .patch(`/api/v1/applications/${applicationId}/withdraw`)
      .set(auth(seeker.token))
      .send({ status: 'withdrawn' });
    expect(withdraw.status).toBe(200);
    expect(withdraw.body.data.status).toBe('withdrawn');

    const job = await JobListing.findById(jobId).lean();
    expect(job?.applicationCount).toBe(0);

    // Terminal: a second withdrawal is rejected and the count stays at 0
    const again = await api()
      .patch(`/api/v1/applications/${applicationId}/withdraw`)
      .set(auth(seeker.token))
      .send({ status: 'withdrawn' });
    expect(again.status).toBe(400);
    expect((await JobListing.findById(jobId).lean())?.applicationCount).toBe(0);

    // Terminal for the employer too
    const review = await api()
      .patch(`/api/v1/applications/${applicationId}/review`)
      .set(auth(employer.token))
      .send({ status: 'accepted' });
    expect(review.status).toBe(400);
  });

  it('another seeker cannot withdraw this application', async () => {
    const other = await createUser('seeker');
    const res = await api()
      .patch(`/api/v1/applications/${applicationId}/withdraw`)
      .set(auth(other.token))
      .send({ status: 'withdrawn' });
    expect(res.status).toBe(404);
  });

  it('admin can read any application', async () => {
    const adminToken = await loginSuperAdmin();
    const res = await api()
      .get(`/api/v1/applications/${applicationId}`)
      .set(auth(adminToken));
    expect(res.status).toBe(200);
    expect(res.body.data.applicantId.email).toBe(seeker.email);

    const asSeeker = await api()
      .get(`/api/v1/applications/${applicationId}`)
      .set(auth(seeker.token));
    expect(asSeeker.status).toBe(403);
  });
});
