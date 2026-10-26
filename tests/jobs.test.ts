import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  api,
  auth,
  createCompany,
  createJob,
  createUser,
  jobPayload,
  loginSuperAdmin,
  setupDatabase,
  teardownDatabase,
} from './helpers';
import { JobCategory } from '../src/app/modules/jobCategory/jobCategory.models';
import { JobListing } from '../src/app/modules/jobListing/jobListing.models';
import { jobCategoryService } from '../src/app/modules/jobCategory/jobCategory.service';

beforeAll(setupDatabase);
afterAll(teardownDatabase);

const categoryCount = async (id: string) =>
  (await JobCategory.findById(id).lean())?.jobCount;

describe('category job counter', () => {
  it('never decrements below zero (regression: guard was ignored)', async () => {
    const category = await JobCategory.create({ name: 'Counter Guard' });
    await jobCategoryService.decrementJobCount(String(category._id));
    expect(await categoryCount(String(category._id))).toBe(0);
  });
});

describe('job categories', () => {
  let adminToken: string;

  beforeAll(async () => {
    adminToken = await loginSuperAdmin();
  });

  const createCategory = async (body: Record<string, unknown>) =>
    api().post('/api/v1/job-categories').set(auth(adminToken)).send(body);

  it('admin creates a hierarchy and reads tree, roots, children and breadcrumb', async () => {
    const root = await createCategory({ name: 'Engineering' });
    expect(root.status).toBe(201);
    expect(root.body.data.slug).toBe('engineering');

    const child = await createCategory({
      name: 'Backend',
      parentId: root.body.data._id,
    });
    expect(child.status).toBe(201);
    expect(child.body.data.depth).toBe(1);

    const tree = await api().get('/api/v1/job-categories/tree');
    const engineering = tree.body.data.find(
      (n: { name: string }) => n.name === 'Engineering',
    );
    expect(engineering.children).toHaveLength(1);

    const roots = await api().get('/api/v1/job-categories/roots');
    expect(
      roots.body.data.some((c: { name: string }) => c.name === 'Engineering'),
    ).toBe(true);

    const children = await api().get(
      `/api/v1/job-categories/${root.body.data._id}/children`,
    );
    expect(children.body.data[0].name).toBe('Backend');

    const bySlug = await api().get('/api/v1/job-categories/slug/backend');
    expect(
      bySlug.body.data.breadcrumb.map((b: { name: string }) => b.name),
    ).toEqual(['Engineering', 'Backend']);
  });

  it('only admins can create categories', async () => {
    const { token } = await createUser('employer');
    const res = await api()
      .post('/api/v1/job-categories')
      .set(auth(token))
      .send({ name: 'Nope' });
    expect(res.status).toBe(403);
  });

  it('rejects duplicate names (case-insensitive) with 409', async () => {
    await createCategory({ name: 'Design' });
    const dup = await createCategory({ name: 'design' });
    expect(dup.status).toBe(409);
  });

  it('prevents moving a category under its own child (cycle)', async () => {
    const parent = await createCategory({ name: 'Data' });
    const child = await createCategory({
      name: 'Analytics',
      parentId: parent.body.data._id,
    });

    const res = await api()
      .patch(`/api/v1/job-categories/${parent.body.data._id}`)
      .set(auth(adminToken))
      .send({ parentId: child.body.data._id });
    expect(res.status).toBe(400);
  });

  it('refuses to delete a category with sub-categories', async () => {
    const parent = await createCategory({ name: 'Marketing' });
    await createCategory({ name: 'SEO', parentId: parent.body.data._id });
    const res = await api()
      .delete(`/api/v1/job-categories/${parent.body.data._id}`)
      .set(auth(adminToken));
    expect(res.status).toBe(400);
  });

  it('admin list supports search and pagination meta', async () => {
    const res = await api()
      .get('/api/v1/job-categories?search=eng&limit=5')
      .set(auth(adminToken));
    expect(res.status).toBe(200);
    expect(
      res.body.data.results.every((c: { name: string }) => /eng/i.test(c.name)),
    ).toBe(true);
    expect(res.body.data.meta.limit).toBe(5);
  });

  it('treats regex metacharacters in search literally', async () => {
    const res = await api()
      .get(`/api/v1/job-categories?search=${encodeURIComponent('(a+)+$')}`)
      .set(auth(adminToken));
    expect(res.status).toBe(200);
    expect(res.body.data.results).toHaveLength(0);
  });
});

describe('companies', () => {
  it('enforces one active company per employer', async () => {
    const { token } = await createUser('employer');
    await createCompany(token, 'First Co');
    const second = await api()
      .post('/api/v1/companies')
      .set(auth(token))
      .send({ name: 'Second Co' });
    expect(second.status).toBe(409);
  });

  it('rejects javascript: URLs', async () => {
    const { token } = await createUser('employer');
    const res = await api()
      .post('/api/v1/companies')
      .set(auth(token))
      .send({ name: 'XSS Co', website: 'javascript:alert(1)' });
    expect(res.status).toBe(400);
  });

  it('public lookup requires verification; admin can verify', async () => {
    const { token } = await createUser('employer');
    const companyId = await createCompany(token, 'Verify Me');

    const before = await api().get(`/api/v1/companies?companyId=${companyId}`);
    expect(before.status).toBe(403);

    const adminToken = await loginSuperAdmin();
    const verify = await api()
      .patch(`/api/v1/companies/${companyId}/verification`)
      .set(auth(adminToken))
      .send({ verificationStatus: 'verified' });
    expect(verify.status).toBe(200);

    const after = await api().get('/api/v1/companies?slug=verify-me');
    expect(after.status).toBe(200);
    expect(after.body.data._id).toBe(companyId);
  });

  it('requires companyId or slug', async () => {
    expect((await api().get('/api/v1/companies')).status).toBe(400);
  });

  it('only the owner/admin members can update; outsiders get 403', async () => {
    const owner = await createUser('employer');
    const outsider = await createUser('employer');
    const companyId = await createCompany(owner.token, 'Owned Co');

    const denied = await api()
      .patch(`/api/v1/companies/${companyId}`)
      .set(auth(outsider.token))
      .send({ description: 'hijacked' });
    expect(denied.status).toBe(403);

    const ok = await api()
      .patch(`/api/v1/companies/${companyId}`)
      .set(auth(owner.token))
      .send({ description: 'Updated description' });
    expect(ok.status).toBe(200);
    expect(ok.body.data.description).toBe('Updated description');
  });

  it('member list is only visible to members and admins', async () => {
    const owner = await createUser('employer');
    const hr = await createUser('employer');
    const outsider = await createUser('employer');
    const companyId = await createCompany(owner.token, 'Team Co');

    const add = await api()
      .post('/api/v1/companies/members')
      .set(auth(owner.token))
      .send({ companyId, userId: hr.id, role: 'HR' });
    expect(add.status).toBe(201);

    const asOutsider = await api()
      .get(`/api/v1/companies/members?companyId=${companyId}`)
      .set(auth(outsider.token));
    expect(asOutsider.status).toBe(403);

    const asMember = await api()
      .get(`/api/v1/companies/members?companyId=${companyId}`)
      .set(auth(hr.token));
    expect(asMember.status).toBe(200);
    expect(asMember.body.data).toHaveLength(2);

    // HR cannot add members
    const hrAdd = await api()
      .post('/api/v1/companies/members')
      .set(auth(hr.token))
      .send({ companyId, userId: outsider.id, role: 'RECRUITER' });
    expect(hrAdd.status).toBe(403);
  });
});

describe('job listings', () => {
  let owner: Awaited<ReturnType<typeof createUser>>;
  let companyId: string;
  let categoryId: string;

  beforeAll(async () => {
    owner = await createUser('employer');
    companyId = await createCompany(owner.token, 'Jobs Inc');
    const adminToken = await loginSuperAdmin();
    const cat = await api()
      .post('/api/v1/job-categories')
      .set(auth(adminToken))
      .send({ name: 'Software' });
    categoryId = cat.body.data._id;
  });

  it('creates a job from a flat payload and defaults expiresAt', async () => {
    const job = await createJob(owner.token, companyId, {
      status: 'draft',
    });
    expect(job.slug).toMatch(/^senior-node-developer-/);
    expect(new Date(job.expiresAt).getTime()).toBeGreaterThan(Date.now());
    expect(job.skills).toEqual(['node.js', 'mongodb']);
  });

  it('still accepts the legacy { body: {...} } wrapper', async () => {
    const res = await api()
      .post('/api/v1/jobs')
      .set(auth(owner.token))
      .send({ body: jobPayload(companyId, { title: 'Legacy Wrapped Job' }) });
    expect(res.status).toBe(201);
    expect(res.body.data.title).toBe('Legacy Wrapped Job');
  });

  it('rejects a past expiry date', async () => {
    const res = await api()
      .post('/api/v1/jobs')
      .set(auth(owner.token))
      .send(
        jobPayload(companyId, {
          expiresAt: new Date(Date.now() - 1000).toISOString(),
        }),
      );
    expect(res.status).toBe(400);
  });

  it('public search works and only returns published, non-expired jobs', async () => {
    const published = await createJob(owner.token, companyId, {
      title: 'Searchable Published Role',
    });
    const draft = await createJob(owner.token, companyId, {
      title: 'Hidden Draft Role',
      status: 'draft',
    });

    // Regression: GET /jobs used to fail validation on every request
    const res = await api().get('/api/v1/jobs?limit=50');
    expect(res.status).toBe(200);
    const ids = res.body.data.map((j: { _id: string }) => j._id);
    expect(ids).toContain(published._id);
    expect(ids).not.toContain(draft._id);
    expect(res.body.meta).toMatchObject({ page: 1, limit: 50 });

    // A client cannot opt into drafts via ?status=draft
    const sneaky = await api().get('/api/v1/jobs?status=draft&limit=50');
    expect(sneaky.body.data.map((j: { _id: string }) => j._id)).not.toContain(
      draft._id,
    );
  });

  it('supports full-text search and filters', async () => {
    await createJob(owner.token, companyId, {
      title: 'Kubernetes Platform Engineer',
      workMode: 'hybrid',
    });
    const text = await api().get(
      '/api/v1/jobs?searchTerm=kubernetes&sortBy=relevance',
    );
    expect(text.status).toBe(200);
    expect(text.body.data[0].title).toBe('Kubernetes Platform Engineer');

    const filtered = await api().get('/api/v1/jobs?workMode=hybrid');
    expect(
      filtered.body.data.every(
        (j: { workMode: string }) => j.workMode === 'hybrid',
      ),
    ).toBe(true);
  });

  it('applies the requested sort order', async () => {
    await createJob(owner.token, companyId, {
      title: 'Low Salary Role',
      salary: { min: 1000, max: 2000 },
    });
    await createJob(owner.token, companyId, {
      title: 'High Salary Role',
      salary: { min: 500000, max: 900000 },
    });
    const res = await api().get('/api/v1/jobs?sortBy=salary&limit=50');
    const maxes = res.body.data.map(
      (j: { salary?: { max?: number } }) => j.salary?.max ?? 0,
    );
    expect(maxes).toEqual([...maxes].sort((a, b) => b - a));
  });

  it('escapes regex input in location filters', async () => {
    const res = await api().get(
      `/api/v1/jobs?city=${encodeURIComponent('.*')}`,
    );
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(0);
  });

  it('validates search query parameters', async () => {
    expect((await api().get('/api/v1/jobs?type=astronaut')).status).toBe(400);
    expect((await api().get('/api/v1/jobs?page=-1')).status).toBe(400);
  });

  it('job detail is public for published jobs and 404 for drafts', async () => {
    const published = await createJob(owner.token, companyId);
    const draft = await createJob(owner.token, companyId, { status: 'draft' });

    const ok = await api().get(`/api/v1/jobs/${published._id}`);
    expect(ok.status).toBe(200);
    expect(ok.body.data.viewCount).toBe(1);
    expect(ok.body.data.companyId.name).toBe('jobs inc');

    const bySlug = await api().get(`/api/v1/jobs/slug/${published.slug}`);
    expect(bySlug.status).toBe(200);

    expect((await api().get(`/api/v1/jobs/${draft._id}`)).status).toBe(404);
    expect((await api().get('/api/v1/jobs/not-an-id')).status).toBe(400);
  });

  it('company members can list all their jobs including drafts', async () => {
    const draft = await createJob(owner.token, companyId, { status: 'draft' });
    const res = await api()
      .get(`/api/v1/jobs/company/${companyId}?status=draft`)
      .set(auth(owner.token));
    expect(res.status).toBe(200);
    expect(res.body.data.map((j: { _id: string }) => j._id)).toContain(
      draft._id,
    );

    const outsider = await createUser('employer');
    const denied = await api()
      .get(`/api/v1/jobs/company/${companyId}`)
      .set(auth(outsider.token));
    expect(denied.status).toBe(403);
  });

  it("prevents another company's employer from editing a job (IDOR)", async () => {
    const job = await createJob(owner.token, companyId);
    const attacker = await createUser('employer');
    const attackerCompany = await createCompany(attacker.token, 'Attacker Co');

    for (const body of [
      { title: 'Hijacked title!' },
      { title: 'Hijacked title!', companyId: attackerCompany },
    ]) {
      const res = await api()
        .patch(`/api/v1/jobs/${job._id}`)
        .set(auth(attacker.token))
        .send(body);
      expect(res.status).toBe(403);
    }

    const status = await api()
      .patch(`/api/v1/jobs/${job._id}/status`)
      .set(auth(attacker.token))
      .send({ status: 'closed', companyId: attackerCompany });
    expect(status.status).toBe(403);

    const del = await api()
      .delete(`/api/v1/jobs/${job._id}`)
      .set(auth(attacker.token));
    expect(del.status).toBe(403);

    const unchanged = await JobListing.findById(job._id).lean();
    expect(unchanged?.title).toBe('Senior Node Developer');
    expect(unchanged?.isActive).toBe(true);
  });

  it('keeps category job counts in sync across status changes and deletion', async () => {
    const job = await createJob(owner.token, companyId, {
      categoryId,
      status: 'draft',
    });
    expect(await categoryCount(categoryId)).toBe(0);

    const setStatus = (status: string) =>
      api()
        .patch(`/api/v1/jobs/${job._id}/status`)
        .set(auth(owner.token))
        .send({ status });

    expect((await setStatus('published')).status).toBe(200);
    expect(await categoryCount(categoryId)).toBe(1);

    // published -> draft must also decrement
    expect((await setStatus('draft')).status).toBe(200);
    expect(await categoryCount(categoryId)).toBe(0);

    expect((await setStatus('draft')).status).toBe(400); // no-op transition

    expect((await setStatus('published')).status).toBe(200);
    const del = await api()
      .delete(`/api/v1/jobs/${job._id}`)
      .set(auth(owner.token));
    expect(del.status).toBe(200);
    expect(await categoryCount(categoryId)).toBe(0);
  });

  it('cannot publish a job whose expiry date has passed', async () => {
    const job = await createJob(owner.token, companyId, { status: 'draft' });
    await JobListing.updateOne(
      { _id: job._id },
      { expiresAt: new Date(Date.now() - 1000) },
    );
    const res = await api()
      .patch(`/api/v1/jobs/${job._id}/status`)
      .set(auth(owner.token))
      .send({ status: 'published' });
    expect(res.status).toBe(400);
  });

  it('admin can feature a job; the body is validated', async () => {
    const job = await createJob(owner.token, companyId);
    const adminToken = await loginSuperAdmin();

    const bad = await api()
      .patch(`/api/v1/jobs/${job._id}/featured`)
      .set(auth(adminToken))
      .send({ isFeatured: 'yes' });
    expect(bad.status).toBe(400);

    const ok = await api()
      .patch(`/api/v1/jobs/${job._id}/featured`)
      .set(auth(adminToken))
      .send({ isFeatured: true });
    expect(ok.status).toBe(200);
    expect(ok.body.data.isFeatured).toBe(true);

    const employer = await api()
      .patch(`/api/v1/jobs/${job._id}/featured`)
      .set(auth(owner.token))
      .send({ isFeatured: true });
    expect(employer.status).toBe(403);
  });

  it('deleting a company deactivates its jobs', async () => {
    const employer = await createUser('employer');
    const doomedCompany = await createCompany(employer.token, 'Doomed Co');
    const job = await createJob(employer.token, doomedCompany);

    const del = await api()
      .delete(`/api/v1/companies/${doomedCompany}`)
      .set(auth(employer.token));
    expect(del.status).toBe(200);

    expect((await api().get(`/api/v1/jobs/${job._id}`)).status).toBe(404);

    // The owner may create a new company after deleting the old one
    await createCompany(employer.token, 'Phoenix Co');
  });
});
