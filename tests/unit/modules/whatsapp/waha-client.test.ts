import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../../../src/core/env', () => ({
  env: {
    APP_URL: 'http://localhost:3000',
    WAHA_BASE_URL: 'https://waha.example.com',
    WAHA_ADMIN_API_KEY: 'test-api-key',
  },
}));

import { AppError } from '../../../../src/core/errors';
import { WahaClient } from '../../../../src/core/providers/waha-client';

describe('WahaClient', () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('times out after 10 seconds and throws WAHA_TIMEOUT', async () => {
    vi.useFakeTimers();

    const fetchMock = vi.fn((_url: string, init?: RequestInit) => {
      return new Promise((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () => {
          reject(new DOMException('Aborted', 'AbortError'));
        });
      });
    });

    vi.stubGlobal('fetch', fetchMock);

    const client = new WahaClient({ baseUrl: 'https://waha.example.com', apiKey: 'super-secret-api-key' });
    const promise = client.getSession('workspace_1');
    const expectation = expect(promise).rejects.toMatchObject({ code: 'WAHA_TIMEOUT' });

    await vi.advanceTimersByTimeAsync(10_001);

    await expectation;
  });

  it('does not leak API keys or HMAC secrets in error messages', async () => {
    const fetchMock = vi.fn().mockRejectedValue(new Error('network offline'));
    vi.stubGlobal('fetch', fetchMock);

    const apiKey = 'super-secret-api-key';
    const secret = 'super-secret-hmac';
    const client = new WahaClient({ baseUrl: 'https://waha.example.com', apiKey });

    await expect(client.createSession('workspace_1', 'https://app.example.com/api/webhooks/waha', secret)).rejects.toMatchObject({
      code: 'WAHA_API_ERROR',
    });

    try {
      await client.createSession('workspace_1', 'https://app.example.com/api/webhooks/waha', secret);
    } catch (error) {
      expect(error).toBeInstanceOf(AppError);
      const message = (error as Error).message;
      expect(message).not.toContain(apiKey);
      expect(message).not.toContain(secret);
    }
  });
});
