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
const logger = createLogger('features/knowledge-uploads/delete-action');

export async function deleteKnowledgeFile(fileId: number): Promise<ActionResult<void>> {
  try {
    const { user, workspaceId } = await getOwnerDashboardSession();

    if (!WORKSPACE_ID_PATTERN.test(workspaceId)) {
      throw new AppError(
        'Invalid workspace context for deletion',
        ErrorCode.VALIDATION_ERROR,
        400,
        'medium'
      );
    }

    await new KnowledgeService().deleteFile(fileId, Number.parseInt(workspaceId, 10), user);

    revalidatePath(KNOWLEDGE_PAGE_PATH);

    return success(undefined);
  } catch (error) {
    if (error instanceof AppError && error.code === ErrorCode.VALIDATION_ERROR) {
      return failure(error.message, error.code);
    }

    logger.error(
      'Knowledge file deletion failed',
      undefined,
      error instanceof Error ? error : undefined
    );

    return failure('Delete failed. Please try again.');
  }
}
