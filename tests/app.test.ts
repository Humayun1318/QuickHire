import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { api, setupDatabase, teardownDatabase } from './helpers';

beforeAll(setupDatabase);
afterAll(teardownDatabase);

describe('app-level behaviour', () => {
  it('serves a health check', async () => {
    const res = await api().get('/');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('sets security headers (helmet) and hides x-powered-by', async () => {
    const res = await api().get('/');
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['content-security-policy']).toBeDefined();
    expect(res.headers['x-powered-by']).toBeUndefined();
  });

  it('returns a JSON 404 for unknown routes', async () => {
    const res = await api().get('/api/v1/does-not-exist');
    expect(res.status).toBe(404);
    expect(res.body).toMatchObject({
      success: false,
      message: 'Route Not Found',
    });
  });

  it('returns 400 (not 500) for malformed JSON', async () => {
    const res = await api()
      .post('/api/v1/auth/login')
      .set('Content-Type', 'application/json')
      .send('{"email": ');
    expect(res.status).toBe(400);
    expect(res.body.message).toBe('Malformed JSON in request body');
  });

  it('rejects oversized bodies with 413', async () => {
    const res = await api()
      .post('/api/v1/auth/login')
      .send({ email: 'a@b.co', password: 'x'.repeat(200 * 1024) });
    expect(res.status).toBe(413);
  });

  it('does not leak stack traces outside development', async () => {
    const res = await api().get('/api/v1/does-not-exist');
    expect(res.body.stack).toBeUndefined();
    expect(res.body.err).toBeUndefined();
  });

  describe('CORS', () => {
    it('allows configured origins with credentials', async () => {
      for (const origin of ['http://localhost:3000', 'http://localhost:5173']) {
        const res = await api().get('/').set('Origin', origin);
        expect(res.status).toBe(200);
        expect(res.headers['access-control-allow-origin']).toBe(origin);
        expect(res.headers['access-control-allow-credentials']).toBe('true');
      }
    });

    it('handles preflight requests', async () => {
      const res = await api()
        .options('/api/v1/auth/login')
        .set('Origin', 'http://localhost:3000')
        .set('Access-Control-Request-Method', 'POST')
        .set('Access-Control-Request-Headers', 'Content-Type');
      expect(res.status).toBe(204);
      expect(res.headers['access-control-allow-methods']).toContain('POST');
    });

    it('rejects other origins with 403', async () => {
      const res = await api()
        .post('/api/v1/auth/logout')
        .set('Origin', 'https://evil.example');
      expect(res.status).toBe(403);
      expect(res.headers['access-control-allow-origin']).toBeUndefined();
    });
  });
});
