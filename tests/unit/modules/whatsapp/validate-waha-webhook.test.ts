import crypto from 'node:crypto';

import { describe, expect, it } from 'vitest';

import {
  extractClientIp,
  validateHmac,
  validateIpAllowlist,
} from '../../../../src/modules/whatsapp/validators/validate-waha-webhook';

describe('validateHmac', () => {
  const secret = 'test-secret';
  const body = JSON.stringify({ event: 'message' });

  it('returns true for a valid sha512 hmac', () => {
    const validHmac = crypto.createHmac('sha512', secret).update(body).digest('hex');

    expect(validateHmac(body, validHmac, secret, 'sha512')).toBe(true);
  });

  it('returns false for an invalid hmac', () => {
    const invalidHmac = crypto.createHmac('sha512', 'wrong-secret').update(body).digest('hex');

    expect(validateHmac(body, invalidHmac, secret, 'sha512')).toBe(false);
  });

  it('returns false when the hmac header is missing', () => {
    expect(validateHmac(body, null, secret, 'sha512')).toBe(false);
  });

  it('returns false when the hmac header is empty', () => {
    expect(validateHmac(body, '', secret, 'sha512')).toBe(false);
  });

  it('returns false when the algorithm header is not sha512', () => {
    const validHmac = crypto.createHmac('sha512', secret).update(body).digest('hex');

    expect(validateHmac(body, validHmac, secret, 'sha256')).toBe(false);
  });
});

describe('validateIpAllowlist', () => {
  it('returns true for an allowed ip', () => {
    expect(validateIpAllowlist('10.0.0.1', ['10.0.0.1'], false)).toBe(true);
  });

  it('returns false for a disallowed ip', () => {
    expect(validateIpAllowlist('10.0.0.2', ['10.0.0.1'], false)).toBe(false);
  });

  it('returns false for an empty allowlist in production mode', () => {
    expect(validateIpAllowlist('10.0.0.1', [], false)).toBe(false);
  });

  it('returns true for any ip in sandbox mode', () => {
    expect(validateIpAllowlist('203.0.113.10', [], true)).toBe(true);
  });
});

describe('extractClientIp', () => {
  it('returns the first forwarded ip', () => {
    const request = new Request('http://localhost', {
      headers: {
        'x-forwarded-for': '203.0.113.5, 198.51.100.10',
      },
    });

    expect(extractClientIp(request)).toBe('203.0.113.5');
  });

  it("returns 'unknown' when the header is missing", () => {
    const request = new Request('http://localhost');

    expect(extractClientIp(request)).toBe('unknown');
  });
});
