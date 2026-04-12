import crypto from 'node:crypto';

import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  getPayloadClientMock,
  getQrCodeMock,
  sendTextMock,
  updateSessionStateMock,
  resolveWorkspaceIdFromSessionNameMock,
  checkStatusGateMock,
  resolveReplyLocaleMock,
} = vi.hoisted(() => ({
  getPayloadClientMock: vi.fn(),
  getQrCodeMock: vi.fn(),
  sendTextMock: vi.fn(),
  updateSessionStateMock: vi.fn(),
  resolveWorkspaceIdFromSessionNameMock: vi.fn(),
  checkStatusGateMock: vi.fn(),
  resolveReplyLocaleMock: vi.fn(),
}));

vi.mock('@/core/env', () => ({
  env: {
    WAHA_WEBHOOK_HMAC_SECRET: 'test-secret',
    WAHA_ALLOWED_IPS: ['203.0.113.5'],
    ENABLE_WAHA_SANDBOX: false,
  },
}));

vi.mock('@/payload/lib', () => ({
  getPayloadClient: getPayloadClientMock,
}));

vi.mock('@/core/providers/waha-client', () => ({
  createWahaClient: () => ({
    getQrCode: getQrCodeMock,
    sendText: sendTextMock,
  }),
}));

vi.mock('@/modules/whatsapp', () => ({
  extractClientIp: (request: Request) => request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown',
  validateHmac: (rawBody: string, hmacHeader: string | null, secret: string, algorithmHeader?: string | null) => {
    if (!hmacHeader) {
      return false;
    }

    if (algorithmHeader && algorithmHeader.toLowerCase() !== 'sha512') {
      return false;
    }

    return crypto.createHmac('sha512', secret).update(rawBody).digest('hex') === hmacHeader;
  },
  validateIpAllowlist: (clientIp: string, allowedIps: string[], sandboxMode: boolean) => {
    if (sandboxMode) {
      return true;
    }

    return allowedIps.includes(clientIp);
  },
  WhatsAppService: class {
    public resolveWorkspaceIdFromSessionName(sessionName: string) {
      return resolveWorkspaceIdFromSessionNameMock(sessionName);
    }

    public updateSessionState(...args: unknown[]) {
      return updateSessionStateMock(...args);
    }
  },
}));

vi.mock('@/modules/workspaces', () => ({
  WorkspacesService: class {
    public checkStatusGate(...args: unknown[]) {
      return checkStatusGateMock(...args);
    }

    public resolveReplyLocale(...args: unknown[]) {
      return resolveReplyLocaleMock(...args);
    }
  },
}));

import { POST } from '../../../src/app/api/webhooks/waha/route';

function buildHmac(body: string): string {
  return crypto.createHmac('sha512', 'test-secret').update(body).digest('hex');
}

function buildRequest(body: string, headers: Record<string, string> = {}): Request {
  return new Request('http://localhost/api/webhooks/waha', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-forwarded-for': '203.0.113.5',
      'x-webhook-hmac': buildHmac(body),
      'x-webhook-hmac-algorithm': 'sha512',
      ...headers,
    },
    body,
  });
}

describe('WAHA webhook route', () => {
  beforeEach(() => {
    getPayloadClientMock.mockReset();
    getQrCodeMock.mockReset();
    sendTextMock.mockReset();
    updateSessionStateMock.mockReset();
    resolveWorkspaceIdFromSessionNameMock.mockReset();
    checkStatusGateMock.mockReset();
    resolveReplyLocaleMock.mockReset();

    getPayloadClientMock.mockResolvedValue({
      findByID: vi.fn().mockResolvedValue({ id: 1, status: 'active' }),
      find: vi.fn().mockResolvedValue({ docs: [{ language_preference: 'ar' }] }),
    });
    resolveWorkspaceIdFromSessionNameMock.mockReturnValue('1');
    checkStatusGateMock.mockResolvedValue({ allowed: true });
    resolveReplyLocaleMock.mockReturnValue('ar');
  });

  it('returns 200 for a valid session.status event', async () => {
    const body = JSON.stringify({
      event: 'session.status',
      session: 'workspace_1',
      payload: { status: 'WORKING' },
      me: { id: '966500000001@c.us' },
    });

    const response = await POST(buildRequest(body));

    expect(response.status).toBe(200);
    expect(updateSessionStateMock).toHaveBeenCalled();
  });

  it('returns 401 for an invalid HMAC', async () => {
    const body = JSON.stringify({ event: 'message', session: 'workspace_1', payload: { from: '1@c.us' } });
    const response = await POST(
      buildRequest(body, {
        'x-webhook-hmac': 'invalid',
      })
    );

    expect(response.status).toBe(401);
  });

  it('returns 401 for invalid HMAC even with malformed JSON', async () => {
    const response = await POST(
      buildRequest('{malformed', {
        'x-webhook-hmac': 'invalid',
      })
    );

    expect(response.status).toBe(401);
  });

  it('returns 401 for a disallowed IP', async () => {
    const body = JSON.stringify({ event: 'message', session: 'workspace_1', payload: { from: '1@c.us' } });
    const response = await POST(
      buildRequest(body, {
        'x-forwarded-for': '198.51.100.9',
      })
    );

    expect(response.status).toBe(401);
  });

  it('returns 401 when the HMAC header is missing', async () => {
    const body = JSON.stringify({ event: 'message', session: 'workspace_1', payload: { from: '1@c.us' } });
    const response = await POST(
      new Request('http://localhost/api/webhooks/waha', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-forwarded-for': '203.0.113.5',
        },
        body,
      })
    );

    expect(response.status).toBe(401);
  });

  it('returns 200 for an unknown session name', async () => {
    resolveWorkspaceIdFromSessionNameMock.mockReturnValue(null);

    const body = JSON.stringify({
      event: 'session.status',
      session: 'unknown_session',
      payload: { status: 'WORKING' },
    });

    const response = await POST(buildRequest(body));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ status: 'ok', note: 'unknown session' });
  });

  it('returns 200 and sends UNAVAILABLE_REPLY for paused or disabled workspaces', async () => {
    checkStatusGateMock.mockResolvedValue({
      allowed: false,
      reason: 'paused',
      replyText: 'عذرًا، الخدمة غير متوفرة حاليًا. يرجى المحاولة لاحقًا.',
    });

    const body = JSON.stringify({
      event: 'message',
      session: 'workspace_1',
      payload: { from: '966500000001@c.us', body: 'مرحبا' },
    });

    const response = await POST(buildRequest(body));

    expect(response.status).toBe(200);
    expect(sendTextMock).toHaveBeenCalledWith(
      'workspace_1',
      '966500000001@c.us',
      'عذرًا، الخدمة غير متوفرة حاليًا. يرجى المحاولة لاحقًا.'
    );
  });

  it('returns 200 and sends TEXT_ONLY_REPLY for unsupported non-text messages', async () => {
    const body = JSON.stringify({
      event: 'message',
      session: 'workspace_1',
      payload: { from: '966500000001@c.us', hasMedia: true, body: '' },
    });

    const response = await POST(buildRequest(body));

    expect(response.status).toBe(200);
    expect(sendTextMock).toHaveBeenCalledWith(
      'workspace_1',
      '966500000001@c.us',
      'عذرًا، نحن نقبل الرسائل النصية فقط في الوقت الحالي.'
    );
  });

  it('returns 200 and ignores outbound fromMe message events', async () => {
    const body = JSON.stringify({
      event: 'message',
      session: 'workspace_1',
      payload: { from: '966500000001@c.us', body: 'sent message', fromMe: true },
    });

    const response = await POST(buildRequest(body));

    expect(response.status).toBe(200);
    expect(sendTextMock).not.toHaveBeenCalled();
    expect(checkStatusGateMock).not.toHaveBeenCalled();
  });
});
