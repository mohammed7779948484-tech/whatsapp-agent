import { beforeEach, describe, expect, it, vi } from 'vitest';

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

  it('returns placeholder responses for job and webhook routes', async () => {
    const jobResponse = await ingestParsePost();
    const webhookResponse = await wahaWebhookPost();

    expect(jobResponse.status).toBe(501);
    expect(webhookResponse.status).toBe(501);

    await expect(jobResponse.json()).resolves.toEqual({
      error: 'Not implemented',
      job: 'ingest-parse',
    });
    await expect(webhookResponse.json()).resolves.toEqual({
      error: 'Not implemented',
      job: 'waha-webhook',
    });
  });
});
