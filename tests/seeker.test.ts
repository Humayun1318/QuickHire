import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  api,
  auth,
  createUser,
  loginSuperAdmin,
  setupDatabase,
  teardownDatabase,
} from './helpers';

beforeAll(setupDatabase);
afterAll(teardownDatabase);

const createProfile = (token: string, body: Record<string, unknown> = {}) =>
  api()
    .post('/api/v1/seeker-profiles/create')
    .set(auth(token))
    .send({
      headline: 'Backend Developer',
      skills: ['Node.js', 'TypeScript'],
      languages: ['English', 'Bengali'],
      ...body,
    });

describe('seeker profile', () => {
  it('creates a profile, rejects duplicates, and computes completeness', async () => {
    const seeker = await createUser('seeker');
    const res = await createProfile(seeker.token);
    expect(res.status).toBe(201);
    expect(res.body.data.skills).toEqual(['node.js', 'typescript']);
    // headline 10 + skills 15 + availabilityStatus (open) 5
    expect(res.body.data.profileCompleteness).toBe(30);

    expect((await createProfile(seeker.token)).status).toBe(409);
  });

  it('a partial update does not wipe other fields (languages regression)', async () => {
    const seeker = await createUser('seeker');
    await createProfile(seeker.token);

    const res = await api()
      .patch('/api/v1/seeker-profiles/update')
      .set(auth(seeker.token))
      .send({ bio: 'I build APIs.' });

    expect(res.status).toBe(200);
    expect(res.body.data.bio).toBe('I build APIs.');
    expect(res.body.data.languages).toEqual(['english', 'bengali']);
    expect(res.body.data.profileCompleteness).toBe(40);
  });

  it('a deleted profile can be created again', async () => {
    const seeker = await createUser('seeker');
    await createProfile(seeker.token);

    const del = await api()
      .delete('/api/v1/seeker-profiles/me')
      .set(auth(seeker.token));
    expect(del.status).toBe(200);
    expect(
      (await api().get('/api/v1/seeker-profiles/me').set(auth(seeker.token)))
        .status,
    ).toBe(404);

    const again = await createProfile(seeker.token, { headline: 'Reborn' });
    expect(again.status).toBe(201);
    expect(again.body.data.headline).toBe('Reborn');
    expect(again.body.data.isActive).toBe(true);
  });

  it('employers see paginated active profiles but never deleted ones', async () => {
    const seeker = await createUser('seeker');
    const profile = (await createProfile(seeker.token)).body.data;
    await api().delete('/api/v1/seeker-profiles/me').set(auth(seeker.token));

    const employer = await createUser('employer');
    const list = await api()
      .get('/api/v1/seeker-profiles?limit=2')
      .set(auth(employer.token));
    expect(list.status).toBe(200);
    expect(list.body.data.length).toBeLessThanOrEqual(2);
    expect(list.body.meta.limit).toBe(2);

    const deleted = await api()
      .get(`/api/v1/seeker-profiles?profileId=${profile._id}&active=false`)
      .set(auth(employer.token));
    expect(deleted.status).toBe(404);

    const adminToken = await loginSuperAdmin();
    const asAdmin = await api()
      .get(`/api/v1/seeker-profiles?profileId=${profile._id}&active=false`)
      .set(auth(adminToken));
    expect(asAdmin.status).toBe(200);
  });

  it('seekers cannot browse other profiles', async () => {
    const seeker = await createUser('seeker');
    expect(
      (await api().get('/api/v1/seeker-profiles').set(auth(seeker.token)))
        .status,
    ).toBe(403);
  });
});

describe('education and experience', () => {
  it('first education adds completeness points, deleting the last removes them', async () => {
    const seeker = await createUser('seeker');
    await createProfile(seeker.token);

    const edu = await api()
      .post('/api/v1/seeker-educations/create')
      .set(auth(seeker.token))
      .send({
        institution: 'BUET',
        degree: 'Bachelor',
        startDate: '2018-01-01T00:00:00.000Z',
        endDate: '2022-01-01T00:00:00.000Z',
      });
    expect(edu.status).toBe(201);

    const me = await api()
      .get('/api/v1/seeker-profiles/me')
      .set(auth(seeker.token));
    expect(me.body.data.profileCompleteness).toBe(45);

    const del = await api()
      .delete(`/api/v1/seeker-educations/delete/${edu.body.data._id}`)
      .set(auth(seeker.token));
    expect(del.status).toBe(200);
    const after = await api()
      .get('/api/v1/seeker-profiles/me')
      .set(auth(seeker.token));
    expect(after.body.data.profileCompleteness).toBe(30);
  });

  it('validates date ordering', async () => {
    const seeker = await createUser('seeker');
    await createProfile(seeker.token);
    const res = await api()
      .post('/api/v1/seeker-educations/create')
      .set(auth(seeker.token))
      .send({
        institution: 'BUET',
        degree: 'Bachelor',
        startDate: '2022-01-01T00:00:00.000Z',
        endDate: '2018-01-01T00:00:00.000Z',
      });
    expect(res.status).toBe(400);
  });

  it('experience preserves the case of responsibilities and awaits completeness', async () => {
    const seeker = await createUser('seeker');
    await createProfile(seeker.token);

    const res = await api()
      .post('/api/v1/seeker-experiences/create')
      .set(auth(seeker.token))
      .send({
        jobTitle: 'Engineer',
        company: 'Acme',
        employmentType: 'full-time',
        startDate: '2020-01-01T00:00:00.000Z',
        isCurrentJob: true,
        responsibilities: ['Built the REST API for Acme Payments'],
        technologiesUsed: ['Node.js'],
      });

    expect(res.status).toBe(201);
    expect(res.body.data.responsibilities).toEqual([
      'Built the REST API for Acme Payments',
    ]);
    expect(res.body.data.technologiesUsed).toEqual(['node.js']);

    // The completeness update is awaited before the response is sent
    const me = await api()
      .get('/api/v1/seeker-profiles/me')
      .set(auth(seeker.token));
    expect(me.body.data.profileCompleteness).toBe(45);
  });

  it("cannot modify another seeker's records", async () => {
    const owner = await createUser('seeker');
    await createProfile(owner.token);
    const exp = await api()
      .post('/api/v1/seeker-experiences/create')
      .set(auth(owner.token))
      .send({
        jobTitle: 'Engineer',
        company: 'Acme',
        employmentType: 'full-time',
        startDate: '2020-01-01T00:00:00.000Z',
        isCurrentJob: true,
      });

    const other = await createUser('seeker');
    const res = await api()
      .patch(`/api/v1/seeker-experiences/update/${exp.body.data._id}`)
      .set(auth(other.token))
      .send({ jobTitle: 'Hacked' });
    expect(res.status).toBe(403);
  });
});
