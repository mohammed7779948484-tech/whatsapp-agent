import { LlamaCloud } from '@llamaindex/llama-cloud';

import { env } from '@/core/env';
import { AppError, ErrorCode } from '@/core/errors';

export function createLlamaParseClient(): LlamaCloud {
  if (
    typeof env.LLAMA_PARSE_API_KEY !== 'string' ||
    env.LLAMA_PARSE_API_KEY.trim().length === 0
  ) {
    throw new AppError(
      'LlamaParse API key is not configured',
      ErrorCode.EXTERNAL_SERVICE_ERROR,
      500,
      'medium'
    );
  }

  return new LlamaCloud({
    apiKey: env.LLAMA_PARSE_API_KEY,
  });
}
