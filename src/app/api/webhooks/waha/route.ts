import { env } from '@/core/env';
import { logger } from '@/core/logger';
import { createWahaClient } from '@/core/providers/waha-client';
import { getPayloadClient } from '@/payload/lib';
import { getSystemReply } from '@/shared/lib';
import {
  extractClientIp,
  validateHmac,
  validateIpAllowlist,
  WhatsAppService,
  type WahaMessagePayload,
  type WahaSessionStatus,
  type WahaWebhookPayload,
} from '@/modules/whatsapp';
import { WorkspacesService } from '@/modules/workspaces';

function normalizePhoneFromJid(jid: string | undefined): string | undefined {
  if (!jid) {
    return undefined;
  }

  return jid.replace(/@c\.us$/, '');
}

function isUnsupportedMessage(payload: WahaMessagePayload): boolean {
  const body = typeof payload.body === 'string' ? payload.body.trim() : '';
  return payload.hasMedia === true || body.length === 0;
}

function isWahaMessagePayload(payload: unknown): payload is WahaMessagePayload {
  if (!payload || typeof payload !== 'object') {
    return false;
  }

  const candidate = payload as Record<string, unknown>;

  if (typeof candidate.from !== 'string' || candidate.from.length === 0) {
    return false;
  }

  if (candidate.body !== undefined && typeof candidate.body !== 'string') {
    return false;
  }

  if (candidate.type !== undefined && typeof candidate.type !== 'string') {
    return false;
  }

  return true;
}

async function resolveAgentLanguagePreference(
  payloadClient: Awaited<ReturnType<typeof getPayloadClient>>,
  workspaceId: string
): Promise<'ar' | 'en' | null> {
  const agentResult = await payloadClient.find({
    collection: 'agents',
    where: {
      workspace: {
        equals: workspaceId,
      },
    },
    limit: 1,
    overrideAccess: true,
    depth: 0,
  });

  const languagePreference = agentResult.docs[0]?.language_preference;
  return languagePreference === 'ar' || languagePreference === 'en' ? languagePreference : null;
}

async function workspaceExists(
  payloadClient: Awaited<ReturnType<typeof getPayloadClient>>,
  workspaceId: string
): Promise<boolean> {
  try {
    const workspace = await payloadClient.findByID({
      collection: 'workspaces',
      id: workspaceId,
      overrideAccess: true,
      depth: 0,
    });

    return Boolean(workspace);
  } catch {
    return false;
  }
}

async function handleSessionStatusEvent(body: WahaWebhookPayload): Promise<Response> {
  const workspaceId = new WhatsAppService().resolveWorkspaceIdFromSessionName(body.session);

  if (!workspaceId) {
    logger.warn('Discarded WAHA session event for unknown session name', {
      session: body.session,
    });
    return Response.json({ status: 'ok', note: 'unknown session' });
  }

  const payloadClient = await getPayloadClient();
  const hasWorkspace = await workspaceExists(payloadClient, workspaceId);

  if (!hasWorkspace) {
    logger.warn('Discarded WAHA session event for missing workspace', {
      session: body.session,
      workspaceId,
    });
    return Response.json({ status: 'ok', note: 'unknown session' });
  }

  const status =
    'status' in body.payload && typeof body.payload.status === 'string'
      ? (body.payload.status as WahaSessionStatus)
      : null;

  if (!status) {
    logger.warn('Discarded WAHA session event with missing status payload', {
      session: body.session,
    });
    return Response.json({ status: 'ok' });
  }

  let qrCode: string | undefined;

  if (status === 'SCAN_QR_CODE') {
    try {
      const qr = await createWahaClient().getQrCode(body.session);
      qrCode = qr.data;
    } catch (error) {
      logger.warn('Failed to fetch QR during WAHA SCAN_QR_CODE event', {
        session: body.session,
        reason: error instanceof Error ? error.message : String(error),
      });
    }
  }

  const phone = normalizePhoneFromJid(body.me?.id);

  await new WhatsAppService().updateSessionState(
    body.session,
    status,
    {
      qrCode,
      phone,
      error: 'error' in body.payload && typeof body.payload.error === 'string' ? body.payload.error : undefined,
    },
    payloadClient
  );

  return Response.json({ status: 'ok' });
}

async function handleMessageEvent(body: WahaWebhookPayload): Promise<Response> {
  const workspaceId = new WhatsAppService().resolveWorkspaceIdFromSessionName(body.session);

  if (!workspaceId) {
    logger.warn('Discarded WAHA message event for unknown session name', {
      session: body.session,
    });
    return Response.json({ status: 'ok', note: 'unknown session' });
  }

  if (!isWahaMessagePayload(body.payload)) {
    logger.warn('Discarded WAHA message event with invalid payload shape', {
      session: body.session,
    });
    return Response.json({ status: 'ok', note: 'invalid payload' });
  }

  const messagePayload = body.payload;
  const payloadClient = await getPayloadClient();
  const workspacesService = new WorkspacesService();

  if (messagePayload.fromMe === true) {
    logger.info('Ignored outbound WAHA message event', {
      session: body.session,
      workspaceId,
    });
    return Response.json({ status: 'ok' });
  }

  try {
    const gate = await workspacesService.checkStatusGate(
      workspaceId,
      payloadClient,
      messagePayload.body ?? ''
    );

    if (!gate.allowed) {
      await createWahaClient().sendText(body.session, messagePayload.from, gate.replyText);
      return Response.json({ status: 'ok' });
    }

    if (isUnsupportedMessage(messagePayload)) {
      const languagePreference = await resolveAgentLanguagePreference(payloadClient, workspaceId);
      const locale = workspacesService.resolveReplyLocale(languagePreference, messagePayload.body ?? '');
      const replyText = getSystemReply('TEXT_ONLY_REPLY', locale);

      await createWahaClient().sendText(body.session, messagePayload.from, replyText);
      return Response.json({ status: 'ok' });
    }
  } catch (error) {
    if (
      error instanceof Error &&
      'code' in error &&
      (error as { code?: string }).code === 'WORKSPACE_NOT_FOUND'
    ) {
      logger.warn('Discarded WAHA message event for missing workspace', {
        session: body.session,
        workspaceId,
      });
      return Response.json({ status: 'ok', note: 'unknown session' });
    }

    throw error;
  }

  return Response.json({ status: 'ok' });
}

export async function POST(request: Request): Promise<Response> {
  try {
    const rawBody = await request.text();
    const hmacHeader = request.headers.get('x-webhook-hmac');
    const algorithmHeader = request.headers.get('x-webhook-hmac-algorithm');
    const clientIp = extractClientIp(request);

    const hmacIsValid = validateHmac(
      rawBody,
      hmacHeader,
      env.WAHA_WEBHOOK_HMAC_SECRET,
      algorithmHeader
    );

    if (!hmacIsValid) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const ipIsAllowed = validateIpAllowlist(
      clientIp,
      env.WAHA_ALLOWED_IPS,
      env.ENABLE_WAHA_SANDBOX
    );

    if (!ipIsAllowed) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = JSON.parse(rawBody) as WahaWebhookPayload;

    if (body.event === 'session.status') {
      try {
        return await handleSessionStatusEvent(body);
      } catch (error) {
        logger.error('Failed to process trusted WAHA session event', undefined, error instanceof Error ? error : undefined);
        return Response.json({ status: 'ok' });
      }
    }

    if (body.event === 'message') {
      try {
        return await handleMessageEvent(body);
      } catch (error) {
        logger.error('Failed to process trusted WAHA message event', undefined, error instanceof Error ? error : undefined);
        return Response.json({ status: 'ok' });
      }
    }

    return Response.json({ status: 'ok' });
  } catch (error) {
    logger.error('Failed to process WAHA webhook', undefined, error instanceof Error ? error : undefined);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}
