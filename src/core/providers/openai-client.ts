import OpenAI from 'openai';

import { env } from '@/core/env';
import { AppError, ErrorCode } from '@/core/errors';

export function createOpenAIClient(): OpenAI {
  if (typeof env.OPENAI_API_KEY !== 'string' || env.OPENAI_API_KEY.trim().length === 0) {
    throw new AppError(
      'OpenAI API key is not configured',
      ErrorCode.EXTERNAL_SERVICE_ERROR,
      500,
      'medium'
    );
  }

  return new OpenAI({
    apiKey: env.OPENAI_API_KEY,
  });
}
