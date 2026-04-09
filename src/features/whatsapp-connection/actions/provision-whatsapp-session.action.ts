'use server';

import { AppError } from '@/core/errors';
import { getOwnerDashboardSession } from '@/core/auth';
import { createLogger } from '@/core/logger';
import { WhatsAppService } from '@/modules/whatsapp';
import { failure, success } from '@/shared/types';

const logger = createLogger('features/whatsapp-connection/provision-action');

export async function provisionWhatsappSessionAction() {
  try {
    const { user, workspaceId } = await getOwnerDashboardSession();
    const result = await new WhatsAppService().provisionSession(workspaceId, user);

    return success(result);
  } catch (error) {
    if (error instanceof AppError) {
      logger.error('Failed to provision WhatsApp session', { code: error.code }, error);
      return failure(error.message, error.code);
    }

    logger.error('Failed to provision WhatsApp session', undefined, error instanceof Error ? error : undefined);
    return failure('Failed to provision WhatsApp session', 'PROVISION_FAILED');
  }
}
