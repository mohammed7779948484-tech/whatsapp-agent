import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@upstash/qstash/nextjs', () => ({
  verifySignatureAppRouter: (handler: (request: Request) => Response | Promise<Response>) => handler,
}));

vi.mock('@/core/env', () => ({
  env: {
    WAHA_WEBHOOK_HMAC_SECRET: 'test-secret',
    WAHA_ALLOWED_IPS: [],
    ENABLE_WAHA_SANDBOX: true,
  },
}));

import { GET as healthGet } from '@/app/api/health/route';
import { GET as readyGet } from '@/app/api/health/ready/route';
import { POST as ingestParsePost } from '@/app/api/jobs/ingest-parse/route';
import { POST as wahaWebhookPost } from '@/app/api/webhooks/waha/route';

const executeMock = vi.fn();

vi.mock('@/payload/lib/get-payload', () => ({
  getPayloadClient: vi.fn(async () => ({
    db: {
      drizzle: {},
      execute: executeMock,
    },
  })),
}));

describe('foundation API routes', () => {
  beforeEach(() => {
    executeMock.mockReset();
  });

  it('returns a liveness payload', async () => {
    const response = await healthGet();

    expect(response.status).toBe(200);

    const body = (await response.json()) as { status: string; timestamp: string };
    expect(body.status).toBe('ok');
    expect(body.timestamp).toMatch(/T/);
  });

  it('returns ready when the database check succeeds', async () => {
    executeMock.mockResolvedValueOnce({ rows: [{ '?column?': 1 }] });

    const response = await readyGet();

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      status: 'ready',
      checks: {
        database: 'ok',
      },
    });
  });

  it('returns unhealthy when the database check fails', async () => {
    executeMock.mockRejectedValueOnce(new Error('database offline'));

    const response = await readyGet();

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toMatchObject({
      status: 'unhealthy',
      checks: {
        database: 'unreachable',
      },
      reason: 'One or more dependencies are not reachable',
    });
  });

  it('rejects invalid job payloads and unsigned WAHA webhooks', async () => {
    const jobResponse = await ingestParsePost(
      new Request('http://localhost/api/jobs/ingest-parse', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
        },
        body: JSON.stringify({}),
      })
    );
    const webhookResponse = await wahaWebhookPost(
      new Request('http://localhost/api/webhooks/waha', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
        },
        body: JSON.stringify({ event: 'message', session: 'workspace_1', payload: {} }),
      })
    );

    expect(jobResponse.status).toBe(400);
    expect(webhookResponse.status).toBe(401);

    await expect(jobResponse.json()).resolves.toEqual({ error: 'Invalid payload' });
    await expect(webhookResponse.json()).resolves.toEqual({
      error: 'Unauthorized',
    });
  });
});
