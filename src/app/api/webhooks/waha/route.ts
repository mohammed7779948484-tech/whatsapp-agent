import { env } from '@/core/env';
import { logger } from '@/core/logger';
import type { WahaWebhookPayload } from '@/modules/whatsapp/types';
import {
  extractClientIp,
  validateHmac,
  validateIpAllowlist,
} from '@/modules/whatsapp/validators/validate-waha-webhook';

async function handleSessionStatusEvent(payload: WahaWebhookPayload): Promise<Response> {
  const status =
    'status' in payload.payload && typeof payload.payload.status === 'string'
      ? payload.payload.status
      : 'unknown';

  logger.info('Received WAHA session status event', {
    session: payload.session,
    status,
  });

  // TODO: T029/T030 will implement session state persistence
  return Response.json({ status: 'ok' });
}

async function handleMessageEvent(_payload: WahaWebhookPayload): Promise<Response> {
  // TODO: T030 will implement paused/disabled and unsupported-message handling
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

    const payload = JSON.parse(rawBody) as WahaWebhookPayload;

    if (payload.event === 'session.status') {
      return handleSessionStatusEvent(payload);
    }

    if (payload.event === 'message') {
      return handleMessageEvent(payload);
    }

    return Response.json({ status: 'ok' });
  } catch (error) {
    logger.error('Failed to process WAHA webhook', undefined, error instanceof Error ? error : undefined);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}
