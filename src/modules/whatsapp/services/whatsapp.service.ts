import { env } from '@/core/env';
import { AppError, ErrorCode } from '@/core/errors';
import { createLogger } from '@/core/logger';
import { createWahaClient } from '@/core/providers/waha-client';
import { getPayloadClient } from '@/payload/lib';
import type { User, WhatsappSession } from '@/payload-types';

import { WAHA_SESSION_NAME_PREFIX } from '../constants';
import { WAHA_STATUS_MAP } from '../constants';
import type { ProviderStatus, WahaSessionStatus } from '../types';

type SessionSummary = {
  sessionId: string;
  providerStatus: ProviderStatus;
  qrCode?: string | null;
};

function getResponseStatus(error: AppError): number | null {
  const value = error.metadata.details?.responseStatus;
  return typeof value === 'number' ? value : null;
}

export class WhatsAppService {
  private readonly logger = createLogger('modules/whatsapp/service');

  private normalizeWorkspaceId(workspaceId: string | number): number {
    const normalizedWorkspaceId =
      typeof workspaceId === 'string' ? Number.parseInt(workspaceId, 10) : workspaceId;

    if (!Number.isFinite(normalizedWorkspaceId)) {
      throw new AppError('Workspace not found', ErrorCode.WORKSPACE_NOT_FOUND, 404, 'medium');
    }

    return normalizedWorkspaceId;
  }

  private async findSessionForWorkspace(
    workspaceId: string | number,
    user: User
  ): Promise<WhatsappSession | null> {
    const payload = await getPayloadClient();
    const result = await payload.find({
      collection: 'whatsapp_sessions',
      where: {
        workspace: {
          equals: workspaceId,
        },
      },
      limit: 1,
      user,
      overrideAccess: false,
      depth: 0,
    });

    return result.docs[0] ?? null;
  }

  public async provisionSession(
    workspaceId: string | number,
    user: User
  ): Promise<SessionSummary> {
    const payload = await getPayloadClient();
    const normalizedWorkspaceId = this.normalizeWorkspaceId(workspaceId);
    const localSession = await this.findSessionForWorkspace(normalizedWorkspaceId, user);
    const sessionName = `${WAHA_SESSION_NAME_PREFIX}${normalizedWorkspaceId}`;
    const wahaClient = createWahaClient();

    let sessionIsStale = false;

    if (localSession && localSession.provider_status !== 'error') {
      try {
        await wahaClient.getSession(sessionName);

        return {
          sessionId: String(localSession.id),
          providerStatus: localSession.provider_status,
          qrCode: localSession.qr_code ?? null,
        };
      } catch (error) {
        if (error instanceof AppError && getResponseStatus(error) === 404) {
          sessionIsStale = true;
        } else {
          throw error;
        }
      }
    }

    if (localSession && (localSession.provider_status === 'error' || sessionIsStale)) {
      await wahaClient.deleteSession(sessionName);

      try {
        // Direct owner CRUD stays closed; this trusted delete uses the already verified
        // workspace + resolved session document to perform the narrow server-side cleanup.
        await payload.delete({
          collection: 'whatsapp_sessions',
          id: localSession.id,
          overrideAccess: true,
        });
      } catch (error) {
        this.logger.warn('Failed to delete stale whatsapp session record after remote delete', {
          workspaceId: normalizedWorkspaceId,
          sessionId: localSession.id,
          reason: error instanceof Error ? error.message : String(error),
        });
      }
    }

    await wahaClient.createSession(
      sessionName,
      `${env.APP_URL}/api/webhooks/waha`,
      env.WAHA_WEBHOOK_HMAC_SECRET
    );

    // Direct owner CRUD stays closed; this trusted create uses the already verified
    // workspace and computed session name instead of widening raw collection write access.
    const createdRecord = await payload.create({
      collection: 'whatsapp_sessions',
      data: {
        workspace: normalizedWorkspaceId,
        session_name: sessionName,
        provider_status: 'disconnected',
      },
      overrideAccess: true,
      depth: 0,
    });

    let providerStatus: ProviderStatus = createdRecord.provider_status;
    let qrCode: string | null = createdRecord.qr_code ?? null;

    try {
      const qr = await wahaClient.getQrCode(sessionName);

      // Direct owner CRUD stays closed; this trusted update mutates only the already
      // resolved workspace session created for the verified owner workspace.
      const updatedRecord = await payload.update({
        collection: 'whatsapp_sessions',
        id: createdRecord.id,
        data: {
          qr_code: qr.data,
          provider_status: 'qr_pending',
        },
        overrideAccess: true,
        depth: 0,
      });

      providerStatus = updatedRecord.provider_status;
      qrCode = updatedRecord.qr_code ?? null;
    } catch (error) {
      this.logger.info('QR code not ready yet after WAHA session provisioning', {
        workspaceId: normalizedWorkspaceId,
        sessionName,
        reason: error instanceof Error ? error.message : String(error),
      });
    }

    return {
      sessionId: String(createdRecord.id),
      providerStatus,
      qrCode,
    };
  }

  public async getSessionForWorkspace(
    workspaceId: string | number,
    user: User
  ): Promise<WhatsappSession | null> {
    await getPayloadClient();
    return this.findSessionForWorkspace(this.normalizeWorkspaceId(workspaceId), user);
  }

  public async disconnectSession(workspaceId: string | number, user: User): Promise<void> {
    const payload = await getPayloadClient();
    const session = await this.findSessionForWorkspace(this.normalizeWorkspaceId(workspaceId), user);

    if (!session) {
      throw new AppError('No session found', ErrorCode.SESSION_NOT_FOUND, 404, 'medium');
    }

    await createWahaClient().deleteSession(session.session_name);

    // Direct owner CRUD stays closed; this trusted update only mutates the already resolved
    // session for the verified owner workspace.
    await payload.update({
      collection: 'whatsapp_sessions',
      id: session.id,
      data: {
        provider_status: 'disconnected',
        connected_phone: null,
        qr_code: null,
        last_synced_at: new Date().toISOString(),
      },
      overrideAccess: true,
      depth: 0,
    });
  }

  public async refreshQrCode(
    workspaceId: string | number,
    user: User
  ): Promise<{ qrCode: string }> {
    const payload = await getPayloadClient();
    const session = await this.findSessionForWorkspace(this.normalizeWorkspaceId(workspaceId), user);

    if (!session) {
      throw new AppError('No session found', ErrorCode.SESSION_NOT_FOUND, 404, 'medium');
    }

    const qr = await createWahaClient().getQrCode(session.session_name);

    // Direct owner CRUD stays closed; this trusted update only mutates the already resolved
    // session for the verified owner workspace.
    await payload.update({
      collection: 'whatsapp_sessions',
      id: session.id,
      data: {
        qr_code: qr.data,
        provider_status: 'qr_pending',
        last_synced_at: new Date().toISOString(),
      },
      overrideAccess: true,
      depth: 0,
    });

    return { qrCode: qr.data };
  }

  public resolveWorkspaceIdFromSessionName(sessionName: string): string | null {
    if (!sessionName.startsWith(WAHA_SESSION_NAME_PREFIX)) {
      return null;
    }

    return sessionName.slice(WAHA_SESSION_NAME_PREFIX.length);
  }

  public async updateSessionState(
    sessionName: string,
    wahaStatus: WahaSessionStatus,
    eventData: Partial<{ qrCode?: string; phone?: string; error?: string }>,
    payload: Awaited<ReturnType<typeof getPayloadClient>>
  ): Promise<void> {
    const sessionResult = await payload.find({
      collection: 'whatsapp_sessions',
      where: {
        session_name: {
          equals: sessionName,
        },
      },
      limit: 1,
      overrideAccess: true,
      depth: 0,
    });

    const session = sessionResult.docs[0] ?? null;

    if (!session) {
      this.logger.warn('Received WAHA session event for missing local session', {
        sessionName,
      });
      return;
    }

    if (!(wahaStatus in WAHA_STATUS_MAP)) {
      this.logger.warn('Received unsupported WAHA session status', {
        sessionName,
        wahaStatus,
      });
      return;
    }

    const providerStatus = WAHA_STATUS_MAP[wahaStatus];
    const updateData: Partial<WhatsappSession> & {
      provider_status: ProviderStatus;
      last_synced_at: string;
    } = {
      provider_status: providerStatus,
      last_synced_at: new Date().toISOString(),
    };

    if (providerStatus === 'connected' && eventData.phone) {
      updateData.connected_phone = eventData.phone;
    }

    if (providerStatus === 'qr_pending' && eventData.qrCode) {
      updateData.qr_code = eventData.qrCode;
    }

    if (providerStatus === 'error' && eventData.error) {
      updateData.last_error = eventData.error;
    }

    if (providerStatus === 'disconnected') {
      updateData.connected_phone = null;
      updateData.qr_code = null;
    }

    await payload.update({
      collection: 'whatsapp_sessions',
      id: session.id,
      data: updateData,
      overrideAccess: true,
      depth: 0,
    });

    this.logger.info('Updated WhatsApp session state from WAHA event', {
      sessionName,
      wahaStatus,
      providerStatus,
    });
  }
}
