import { describe, expect, it } from 'vitest';
import { escapeRegex } from '../src/app/utils/escapeRegex';
import {
  createOAuthState,
  isNonceMatch,
  parseOAuthState,
  sanitizeRedirectPath,
} from '../src/app/modules/auth/auth.utils';
import { buildJobQuery } from '../src/app/modules/jobListing/jobListing.utils';
import { handlerDuplicateError } from '../src/app/helpers/handlerDuplicateError';

describe('escapeRegex', () => {
  it('escapes all metacharacters', () => {
    const input = '.*+?^${}()|[]\\';
    expect(new RegExp(`^${escapeRegex(input)}$`).test(input)).toBe(true);
  });
});

describe('OAuth state helpers', () => {
  it.each([
    ['https://evil.com', '/'],
    ['//evil.com', '/'],
    ['/\\evil.com', '/'],
    ['evil.com', '/'],
    [undefined, '/'],
    ['/dashboard?tab=1', '/dashboard?tab=1'],
  ])('sanitizeRedirectPath(%s) -> %s', (input, expected) => {
    expect(sanitizeRedirectPath(input)).toBe(expected);
  });

  it('round-trips the state and restricts the role', () => {
    const { nonce, state } = createOAuthState({
      role: 'super_admin',
      redirect: '/jobs',
    });
    const parsed = parseOAuthState(state);
    expect(parsed).toEqual({ n: nonce, role: 'seeker', redirect: '/jobs' });

    const employer = parseOAuthState(
      createOAuthState({ role: 'employer' }).state,
    );
    expect(employer?.role).toBe('employer');
  });

  it('rejects malformed state and mismatched nonces', () => {
    expect(parseOAuthState('not-base64-json')).toBeNull();
    expect(parseOAuthState(undefined)).toBeNull();
    expect(isNonceMatch('abc', 'abd')).toBe(false);
    expect(isNonceMatch(undefined, 'abc')).toBe(false);
    expect(isNonceMatch('abc', 'abc')).toBe(true);
  });
});

describe('buildJobQuery', () => {
  it('always restricts to published, active, non-expired jobs', () => {
    const { filter } = buildJobQuery({});
    expect(filter).toMatchObject({ isActive: true, status: 'published' });
    expect(filter.expiresAt).toEqual({ $gt: expect.any(Date) });
  });

  it('caps the page size and normalizes pagination', () => {
    expect(buildJobQuery({ limit: '1000', page: '3' })).toMatchObject({
      limit: 50,
      page: 3,
      skip: 100,
    });
    expect(buildJobQuery({ limit: '0', page: '0' })).toMatchObject({
      limit: 1,
      page: 1,
    });
  });

  it('only sorts by text score when a search term is present', () => {
    expect(buildJobQuery({ sortBy: 'relevance' }).sort).toEqual({
      isFeatured: -1,
      createdAt: -1,
    });
    expect(
      buildJobQuery({ sortBy: 'relevance', searchTerm: 'node' }).sort,
    ).toEqual({ score: { $meta: 'textScore' } });
  });
});

describe('handlerDuplicateError', () => {
  it('maps to 409 without echoing the duplicate value', () => {
    const result = handlerDuplicateError({
      keyValue: { email: 'victim@example.com' },
    });
    expect(result.statusCode).toBe(409);
    expect(result.message).toBe('email already exists');
  });

  it('does not crash when keyValue is missing', () => {
    expect(handlerDuplicateError({}).message).toBe('Resource already exists');
  });
});
