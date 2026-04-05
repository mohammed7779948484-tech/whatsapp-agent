import { describe, expect, it } from 'vitest';

import { createNotImplementedResponse } from '@/app/api/_lib/not-implemented';

describe('createNotImplementedResponse', () => {
  it('returns a 501 payload for placeholder routes', async () => {
    const response = createNotImplementedResponse('ingest-parse');

    expect(response.status).toBe(501);
    await expect(response.json()).resolves.toEqual({
      error: 'Not implemented',
      job: 'ingest-parse',
    });
  });
});
