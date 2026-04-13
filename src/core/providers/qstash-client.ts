import { Client } from '@upstash/qstash';

import { env } from '@/core/env';
import { AppError, ErrorCode } from '@/core/errors';

export function createQstashClient(): Client {
  if (typeof env.QSTASH_TOKEN !== 'string' || env.QSTASH_TOKEN.trim().length === 0) {
    throw new AppError(
      'QStash is not configured',
      ErrorCode.QSTASH_NOT_CONFIGURED,
      500,
      'medium'
    );
  }

  return new Client({
    token: env.QSTASH_TOKEN,
  });
}
