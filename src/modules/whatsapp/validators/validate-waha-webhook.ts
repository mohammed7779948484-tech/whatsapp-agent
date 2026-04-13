import crypto from 'node:crypto';

import { WAHA_HMAC_ALGORITHM } from '../constants';

export function validateHmac(
  rawBody: string,
  hmacHeader: string | null,
  secret: string,
  algorithmHeader?: string | null
): boolean {
  if (!hmacHeader) {
    return false;
  }

  if (algorithmHeader && algorithmHeader.toLowerCase() !== WAHA_HMAC_ALGORITHM) {
    return false;
  }

  try {
    const expected = crypto.createHmac(WAHA_HMAC_ALGORITHM, secret).update(rawBody).digest('hex');

    return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(hmacHeader));
  } catch {
    return false;
  }
}

export function validateIpAllowlist(
  clientIp: string,
  allowedIps: string[],
  sandboxMode: boolean
): boolean {
  if (sandboxMode) {
    return true;
  }

  if (allowedIps.length === 0) {
    return false;
  }

  return allowedIps.includes(clientIp);
}

export function extractClientIp(request: Request): string {
  const forwardedFor = request.headers.get('x-forwarded-for');

  if (!forwardedFor) {
    return 'unknown';
  }

  return forwardedFor.split(',')[0]?.trim() || 'unknown';
}
