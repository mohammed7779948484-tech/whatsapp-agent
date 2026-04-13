'use server';

import { revalidatePath } from 'next/cache';

import { getOwnerDashboardSession } from '@/core/auth';
import { AppError, ErrorCode } from '@/core/errors';
import { createLogger } from '@/core/logger';
import { KnowledgeService } from '@/modules/knowledge';
import type { ActionResult } from '@/shared/types';
import { failure, success } from '@/shared/types';

import { KNOWLEDGE_PAGE_PATH } from '../constants';

const WORKSPACE_ID_PATTERN = /^\d+$/;
const logger = createLogger('features/knowledge-uploads/retry-action');

export async function retryIngestion(fileId: number): Promise<ActionResult<{ jobId: number }>> {
  try {
    const { user, workspaceId } = await getOwnerDashboardSession();

    if (!WORKSPACE_ID_PATTERN.test(workspaceId)) {
      throw new AppError(
        'Invalid workspace context for retry',
        ErrorCode.VALIDATION_ERROR,
        400,
        'medium'
      );
    }

    const result = await new KnowledgeService().retryIngestion(
      fileId,
      Number.parseInt(workspaceId, 10),
      user
    );

    revalidatePath(KNOWLEDGE_PAGE_PATH);

    return success(result);
  } catch (error) {
    if (error instanceof AppError && error.code === ErrorCode.VALIDATION_ERROR) {
      return failure(error.message, error.code);
    }

    logger.error('Knowledge ingestion retry failed', undefined, error instanceof Error ? error : undefined);

    return failure('Retry failed. Please try again.');
  }
}
