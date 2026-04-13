'use server';

import { getOwnerDashboardSession } from '@/core/auth';
import { AppError } from '@/core/errors';
import { createLogger } from '@/core/logger';
import { WhatsAppService } from '@/modules/whatsapp';
import { failure, success } from '@/shared/types';

const logger = createLogger('features/whatsapp-connection/refresh-qr-action');

export async function refreshWhatsappQrAction() {
  try {
    const { user, workspaceId } = await getOwnerDashboardSession();
    const result = await new WhatsAppService().refreshQrCode(workspaceId, user);

    return success(result);
  } catch (error) {
    if (error instanceof AppError) {
      logger.error('Failed to refresh WhatsApp QR code', { code: error.code }, error);
      return failure(error.message, error.code);
    }

    logger.error('Failed to refresh WhatsApp QR code', undefined, error instanceof Error ? error : undefined);
    return failure('Failed to refresh WhatsApp QR code', 'REFRESH_QR_FAILED');
  }
}
