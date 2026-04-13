'use server';

import { revalidatePath } from 'next/cache';

import { getOwnerDashboardSession } from '@/core/auth';
import { env } from '@/core/env';
import { AppError, ErrorCode } from '@/core/errors';
import { createLogger } from '@/core/logger';
import { KnowledgeService } from '@/modules/knowledge';
import type { ActionResult } from '@/shared/types';
import { failure, success } from '@/shared/types';

import { KNOWLEDGE_PAGE_PATH } from '../constants';

const ACCEPTED_MIME_TYPES = new Set(['application/pdf', 'text/csv']);
const logger = createLogger('features/knowledge-uploads/upload-action');

export async function uploadKnowledgeFile(
  formData: FormData
): Promise<ActionResult<{ fileId: number }>> {
  try {
    const { user, workspaceId } = await getOwnerDashboardSession();
    const numericWorkspaceId = Number.parseInt(workspaceId, 10);
    const uploadedFile = formData.get('file');

    if (!(uploadedFile instanceof File)) {
      return failure('Only PDF and CSV files are accepted');
    }

    if (!ACCEPTED_MIME_TYPES.has(uploadedFile.type)) {
      return failure('Only PDF and CSV files are accepted');
    }

    if (uploadedFile.size > env.MAX_UPLOAD_MB * 1024 * 1024) {
      return failure(`File exceeds the maximum size of ${env.MAX_UPLOAD_MB} MB`);
    }

    if (typeof env.QSTASH_TOKEN !== 'string' || env.QSTASH_TOKEN.trim().length === 0) {
      return failure('File processing is not available. Contact support.');
    }

    const result = await new KnowledgeService().uploadFile({
      workspaceId: numericWorkspaceId,
      user,
      file: uploadedFile,
    });

    revalidatePath(KNOWLEDGE_PAGE_PATH);

    return success(result);
  } catch (error) {
    if (
      error instanceof AppError &&
      (error.code === ErrorCode.FILE_LIMIT_EXCEEDED || error.code === ErrorCode.VALIDATION_ERROR)
    ) {
      return failure(error.message, error.code);
    }

    logger.error(
      'Knowledge file upload failed',
      undefined,
      error instanceof Error ? error : undefined
    );
    return failure('Upload failed. Please try again.');
  }
}
