import { describe, expect, it, vi } from 'vitest';

import { WorkspacesService } from '../../../../src/modules/workspaces';

describe('WorkspacesService.checkStatusGate', () => {
  it('returns allowed for an active workspace', async () => {
    const payload = {
      findByID: vi.fn().mockResolvedValue({ id: 1, status: 'active' }),
      find: vi.fn(),
    } as never;

    const result = await new WorkspacesService().checkStatusGate(1, payload, 'hello');

    expect(result).toEqual({ allowed: true });
  });

  it('returns blocked with Arabic reply for a paused workspace with Arabic preference', async () => {
    const payload = {
      findByID: vi.fn().mockResolvedValue({ id: 1, status: 'paused' }),
      find: vi.fn().mockResolvedValue({
        docs: [{ language_preference: 'ar' }],
      }),
    } as never;

    const result = await new WorkspacesService().checkStatusGate(1, payload, 'hello');

    expect(result).toEqual({
      allowed: false,
      reason: 'paused',
      replyText: 'عذرًا، الخدمة غير متوفرة حاليًا. يرجى المحاولة لاحقًا.',
    });
  });

  it('returns blocked for a disabled workspace', async () => {
    const payload = {
      findByID: vi.fn().mockResolvedValue({ id: 1, status: 'disabled' }),
      find: vi.fn().mockResolvedValue({ docs: [] }),
    } as never;

    const result = await new WorkspacesService().checkStatusGate(1, payload, 'Hello there');

    expect(result.allowed).toBe(false);
    if (result.allowed) {
      throw new Error('Expected blocked result');
    }
    expect(result.reason).toBe('disabled');
    expect(result.replyText).toBe('Sorry, the service is currently unavailable. Please try again later.');
  });

  it('throws WORKSPACE_NOT_FOUND when the workspace lookup fails', async () => {
    const payload = {
      findByID: vi.fn().mockRejectedValue(new Error('Workspace not found')),
      find: vi.fn(),
    } as never;

    await expect(new WorkspacesService().checkStatusGate(1, payload, 'hello')).rejects.toMatchObject({
      code: 'WORKSPACE_NOT_FOUND',
    });
  });
});
