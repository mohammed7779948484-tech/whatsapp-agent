import type { ProviderStatus } from '@/modules/whatsapp';

export interface WhatsAppConnectionState {
  sessionId: string | null;
  providerStatus: ProviderStatus | null;
  qrCode: string | null;
  connectedPhone: string | null;
  lastSyncedAt: string | null;
  lastError: string | null;
}
