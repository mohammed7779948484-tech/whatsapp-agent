'use server';

import { AppError } from '@/core/errors';
import { getOwnerDashboardSession } from '@/core/auth';
import { createLogger } from '@/core/logger';
import { WhatsAppService } from '@/modules/whatsapp';
import { failure, success } from '@/shared/types';

const logger = createLogger('features/whatsapp-connection/disconnect-action');

export async function disconnectWhatsappSessionAction() {
  try {
    const { user, workspaceId } = await getOwnerDashboardSession();
    await new WhatsAppService().disconnectSession(workspaceId, user);

    return success(undefined);
  } catch (error) {
    if (error instanceof AppError) {
      logger.error('Failed to disconnect WhatsApp session', { code: error.code }, error);
      return failure(error.message, error.code);
    }

    logger.error('Failed to disconnect WhatsApp session', undefined, error instanceof Error ? error : undefined);
    return failure('Failed to disconnect WhatsApp session', 'DISCONNECT_FAILED');
  }
}
