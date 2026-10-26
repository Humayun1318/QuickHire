import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import jwt from 'jsonwebtoken';
import {
  api,
  auth,
  createUser,
  login,
  loginSuperAdmin,
  PASSWORD,
  register,
  setupDatabase,
  teardownDatabase,
  uniqueEmail,
} from './helpers';
import { User } from '../src/app/modules/user/user.models';
import { AccountStatus } from '../src/app/modules/user/user.interface';

beforeAll(setupDatabase);
afterAll(teardownDatabase);

describe('registration', () => {
  it('registers a seeker and never returns the password', async () => {
    const email = uniqueEmail('reg');
    const res = await api()
      .post('/api/v1/auth/register')
      .send({ name: 'Jane Doe', email, password: PASSWORD, role: 'seeker' });

    expect(res.status).toBe(201);
    expect(res.body.data.email).toBe(email);
    expect(res.body.data.role).toBe('seeker');
    expect(res.body.data.password).toBeUndefined();
    expect(res.body.data.tokenVersion).toBeUndefined();

    const stored = await User.findOne({ email }).select('+password').lean();
    expect(stored?.password).toMatch(/^\$2[aby]\$/); // bcrypt hash
  });

  it('defaults to the seeker role', async () => {
    const res = await api()
      .post('/api/v1/auth/register')
      .send({
        name: 'No Role',
        email: uniqueEmail('norole'),
        password: PASSWORD,
      });
    expect(res.status).toBe(201);
    expect(res.body.data.role).toBe('seeker');
  });

  it.each(['super_admin', 'admin'])(
    'rejects self-registration as %s (privilege escalation)',
    async (role) => {
      const email = uniqueEmail('escalate');
      const res = await api()
        .post('/api/v1/auth/register')
        .send({ name: 'Mallory', email, password: PASSWORD, role });

      expect(res.status).toBe(400);
      expect(await User.exists({ email })).toBeNull();
    },
  );

  it('ignores mass-assigned fields such as status and auths', async () => {
    const email = uniqueEmail('mass');
    const res = await api().post('/api/v1/auth/register').send({
      name: 'Mass Assign',
      email,
      password: PASSWORD,
      status: 'banned',
      isVerified: true,
      tokenVersion: 99,
    });

    expect(res.status).toBe(201);
    const stored = await User.findOne({ email }).lean();
    expect(stored?.status).toBe(AccountStatus.ACTIVE);
    expect(stored?.isVerified).toBe(false);
    expect(stored?.tokenVersion).toBe(0);
  });

  it('returns 409 for a duplicate email', async () => {
    const { email } = await register('seeker');
    const res = await api()
      .post('/api/v1/auth/register')
      .send({ name: 'Dup', email, password: PASSWORD });
    expect(res.status).toBe(409);
  });

  it('rejects weak passwords with field-level errors', async () => {
    const res = await api()
      .post('/api/v1/auth/register')
      .send({ name: 'Weak', email: uniqueEmail('weak'), password: 'short' });
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(
      res.body.errorSources.some(
        (e: { path: string }) => e.path === 'password',
      ),
    ).toBe(true);
  });

  it('rejects non-string values (NoSQL operator injection)', async () => {
    const res = await api()
      .post('/api/v1/auth/login')
      .send({ email: { $ne: null }, password: { $ne: null } });
    expect(res.status).toBe(400);
  });
});

describe('login', () => {
  it('returns tokens and sets httpOnly cookies', async () => {
    const { email } = await register('seeker');
    const res = await api()
      .post('/api/v1/auth/login')
      .send({ email, password: PASSWORD });

    expect(res.status).toBe(200);
    expect(res.body.data.accessToken).toEqual(expect.any(String));
    expect(res.body.data.user.password).toBeUndefined();
    const cookies = res.headers['set-cookie'] as unknown as string[];
    expect(
      cookies.some(
        (c) => c.startsWith('accessToken=') && c.includes('HttpOnly'),
      ),
    ).toBe(true);
    expect(cookies.some((c) => c.startsWith('refreshToken='))).toBe(true);
  });

  it('uses the same message for unknown email and wrong password', async () => {
    const { email } = await register('seeker');
    const wrongPassword = await api()
      .post('/api/v1/auth/login')
      .send({ email, password: 'Wrong1!pass' });
    const unknownEmail = await api()
      .post('/api/v1/auth/login')
      .send({ email: uniqueEmail('ghost'), password: PASSWORD });

    expect(wrongPassword.status).toBe(401);
    expect(unknownEmail.status).toBe(401);
    expect(wrongPassword.body.message).toBe(unknownEmail.body.message);
  });

  it('rejects suspended accounts', async () => {
    const { email } = await register('seeker');
    await User.updateOne({ email }, { status: AccountStatus.SUSPENDED });
    const res = await api()
      .post('/api/v1/auth/login')
      .send({ email, password: PASSWORD });
    expect(res.status).toBe(401);
    expect(res.body.message).toMatch(/suspended/);
  });
});

describe('checkAuth', () => {
  it('accepts "Bearer <token>", a bare token, and the cookie', async () => {
    const { email, token } = await createUser('seeker');

    const bearer = await api().get('/api/v1/users/me').set(auth(token));
    const bare = await api()
      .get('/api/v1/users/me')
      .set('Authorization', token);
    const cookie = await api()
      .get('/api/v1/users/me')
      .set('Cookie', `accessToken=${token}`);

    for (const res of [bearer, bare, cookie]) {
      expect(res.status).toBe(200);
      expect(res.body.data.email).toBe(email);
    }
  });

  it('returns 401 (not 500) for missing, malformed and expired tokens', async () => {
    const missing = await api().get('/api/v1/users/me');
    const malformed = await api()
      .get('/api/v1/users/me')
      .set(auth('not-a-jwt'));
    const expired = jwt.sign(
      { userId: '507f1f77bcf86cd799439011', role: 'seeker', tv: 0 },
      'test-access-secret',
      { expiresIn: -10 },
    );
    const expiredRes = await api().get('/api/v1/users/me').set(auth(expired));

    expect(missing.status).toBe(401);
    expect(malformed.status).toBe(401);
    expect(expiredRes.status).toBe(401);
  });

  it('rejects tokens signed with another secret or the "none" algorithm', async () => {
    const { id } = await createUser('seeker');
    const forged = jwt.sign(
      { userId: id, role: 'super_admin' },
      'wrong-secret',
    );
    const unsigned = jwt.sign({ userId: id, role: 'super_admin' }, '', {
      algorithm: 'none',
    });

    expect((await api().get('/api/v1/users').set(auth(forged))).status).toBe(
      401,
    );
    expect((await api().get('/api/v1/users').set(auth(unsigned))).status).toBe(
      401,
    );
  });

  it('authorizes with the current database role, not the token claim', async () => {
    const { id } = await createUser('seeker');
    // Token claims admin, database says seeker
    const token = jwt.sign(
      { userId: id, role: 'super_admin', tv: 0 },
      'test-access-secret',
      { expiresIn: '1h' },
    );
    const res = await api().get('/api/v1/users').set(auth(token));
    expect(res.status).toBe(403);
  });

  it('blocks a user immediately after suspension', async () => {
    const { id, token } = await createUser('seeker');
    await User.updateOne({ _id: id }, { status: AccountStatus.BANNED });
    const res = await api().get('/api/v1/users/me').set(auth(token));
    expect(res.status).toBe(403);
  });
});

describe('refresh token, password change and logout', () => {
  it('issues a new access token from the refresh cookie', async () => {
    const { email } = await register('seeker');
    const loginRes = await api()
      .post('/api/v1/auth/login')
      .send({ email, password: PASSWORD });
    const refreshToken = loginRes.body.data.refreshToken;

    const res = await api()
      .post('/api/v1/auth/refresh-token')
      .set('Cookie', `refreshToken=${refreshToken}`);

    expect(res.status).toBe(200);
    const me = await api()
      .get('/api/v1/users/me')
      .set(auth(res.body.data.accessToken));
    expect(me.status).toBe(200);
  });

  it('rejects a missing or invalid refresh token with 401', async () => {
    expect((await api().post('/api/v1/auth/refresh-token')).status).toBe(401);
    const bad = await api()
      .post('/api/v1/auth/refresh-token')
      .send({ refreshToken: 'garbage' });
    expect(bad.status).toBe(401);
  });

  it('validates the change-password payload', async () => {
    const { token } = await createUser('seeker');
    const res = await api()
      .post('/api/v1/auth/change-password')
      .set(auth(token))
      .send({ oldPassword: PASSWORD });
    expect(res.status).toBe(400);
  });

  it('changing the password invalidates previously issued tokens', async () => {
    const { email } = await register('seeker');
    const loginRes = await api()
      .post('/api/v1/auth/login')
      .send({ email, password: PASSWORD });
    const { accessToken, refreshToken } = loginRes.body.data;

    const newPassword = 'N3wPassword!';
    const change = await api()
      .post('/api/v1/auth/change-password')
      .set(auth(accessToken))
      .send({ oldPassword: PASSWORD, newPassword });
    expect(change.status).toBe(200);

    // Old tokens are rejected
    expect(
      (await api().get('/api/v1/users/me').set(auth(accessToken))).status,
    ).toBe(401);
    const oldRefresh = await api()
      .post('/api/v1/auth/refresh-token')
      .send({ refreshToken });
    expect(oldRefresh.status).toBe(401);

    // Tokens returned by change-password work
    const fresh = await api()
      .get('/api/v1/users/me')
      .set(auth(change.body.data.accessToken));
    expect(fresh.status).toBe(200);

    // Old password no longer works, new one does
    const oldLogin = await api()
      .post('/api/v1/auth/login')
      .send({ email, password: PASSWORD });
    expect(oldLogin.status).toBe(401);
    expect(await login(email, newPassword)).toEqual(expect.any(String));
  });

  it('rejects a wrong old password', async () => {
    const { token } = await createUser('seeker');
    const res = await api()
      .post('/api/v1/auth/change-password')
      .set(auth(token))
      .send({ oldPassword: 'Wrong1!pass', newPassword: 'An0ther!Pass' });
    expect(res.status).toBe(401);
  });

  it('logout clears both auth cookies', async () => {
    const res = await api().post('/api/v1/auth/logout');
    expect(res.status).toBe(200);
    const cookies = res.headers['set-cookie'] as unknown as string[];
    expect(cookies.some((c) => c.startsWith('accessToken=;'))).toBe(true);
    expect(cookies.some((c) => c.startsWith('refreshToken=;'))).toBe(true);
  });
});

describe('users module', () => {
  it('GET /users/:id requires an admin', async () => {
    const { id, token } = await createUser('seeker');
    expect((await api().get(`/api/v1/users/${id}`)).status).toBe(401);
    expect(
      (await api().get(`/api/v1/users/${id}`).set(auth(token))).status,
    ).toBe(403);

    const adminToken = await loginSuperAdmin();
    const res = await api().get(`/api/v1/users/${id}`).set(auth(adminToken));
    expect(res.status).toBe(200);
    expect(res.body.data.password).toBeUndefined();
  });

  it('GET /users is paginated and filterable for admins', async () => {
    await createUser('employer');
    const adminToken = await loginSuperAdmin();
    const res = await api()
      .get('/api/v1/users?role=employer&limit=1')
      .set(auth(adminToken));

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].role).toBe('employer');
    expect(res.body.meta.limit).toBe(1);
    expect(res.body.meta.total).toBeGreaterThanOrEqual(1);
  });

  it('GET /users rejects unknown query parameters', async () => {
    const adminToken = await loginSuperAdmin();
    const res = await api()
      .get('/api/v1/users?role=emperor')
      .set(auth(adminToken));
    expect(res.status).toBe(400);
  });

  it('returns 400 for a malformed ObjectId', async () => {
    const adminToken = await loginSuperAdmin();
    const res = await api()
      .get('/api/v1/users/not-an-id')
      .set(auth(adminToken));
    expect(res.status).toBe(400);
  });
});

describe('Google OAuth when not configured', () => {
  it('responds 503 instead of crashing', async () => {
    expect((await api().get('/api/v1/auth/google')).status).toBe(503);
    expect((await api().get('/api/v1/auth/google/callback')).status).toBe(503);
  });
});
