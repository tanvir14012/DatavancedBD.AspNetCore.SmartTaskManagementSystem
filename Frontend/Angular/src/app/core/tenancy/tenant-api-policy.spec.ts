import { describe, expect, it } from 'vitest';
import { TenantApiPolicy } from './tenant-api-policy';

describe('TenantApiPolicy', () => {
  const policy = new TenantApiPolicy({
    baseUrl: 'https://app.example.test/ui/',
    allowedOrigins: ['https://api.example.test', 'http://localhost:5000'],
  });

  it.each(['https://API.example.test:443/tasks', '//api.example.test/tasks', 'http://localhost:5000/api'])
    ('matches an exact canonical API origin: %s', (url) => expect(policy.includes(url)).toBe(true));

  it.each([
    '/api/tasks', 'https://api.example.test.evil.test/tasks', 'http://api.example.test/tasks',
    'https://api.example.test:444/tasks', 'https://api.example.test@evil.test/tasks',
    'https://user:secret@api.example.test/tasks', 'data:text/plain,https://api.example.test', 'http://[',
  ])('never matches unrelated or malformed URLs: %s', (url) => expect(policy.includes(url)).toBe(false));

  it('resolves relative URLs against the explicitly configured document base', () => {
    const sameOrigin = new TenantApiPolicy({ baseUrl: 'https://app.example.test/ui/', allowedOrigins: ['https://app.example.test'] });
    expect(sameOrigin.includes('../api/tasks')).toBe(true);
  });

  it.each(['https://api.test/path', 'https://api.test?x=1', 'https://api.test/#hash', 'https://user:secret@api.test', '*', 'file:///tmp', ' https://api.test', 'https:\\api.test'])
    ('rejects invalid allowlist bindings without including their values: %s', (url) => {
      expect(() => new TenantApiPolicy({ baseUrl: 'https://app.test/', allowedOrigins: [url] })).toThrowError();
      try {
        new TenantApiPolicy({ baseUrl: 'https://app.test/', allowedOrigins: [url] });
      } catch (error) {
        expect((error as Error).message).not.toContain(url);
      }
    });

  it('copies deployment options instead of retaining mutable inventory', () => {
    const origins = ['https://api.test'];
    const snapshot = new TenantApiPolicy({ baseUrl: 'https://app.test/', allowedOrigins: origins });
    origins.push('https://evil.test');
    expect(snapshot.includes('https://evil.test')).toBe(false);
  });

  it('rejects empty allowlists and non-absolute or ambiguous bases', () => {
    expect(() => new TenantApiPolicy({ baseUrl: 'https://app.test/', allowedOrigins: [] })).toThrowError();
    for (const baseUrl of ['/relative', 'https://app.test?secret', 'https://app.test/#fragment']) {
      expect(() => new TenantApiPolicy({ baseUrl, allowedOrigins: ['https://api.test'] })).toThrowError();
    }
  });
});
