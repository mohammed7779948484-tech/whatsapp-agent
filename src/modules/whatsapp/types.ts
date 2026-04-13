export type WahaWebhookEventType = 'session.status' | 'message' | 'message.ack';

export type WahaSessionStatus = 'STARTING' | 'SCAN_QR_CODE' | 'WORKING' | 'FAILED' | 'STOPPED';

export type ProviderStatus = 'connected' | 'disconnected' | 'qr_pending' | 'error';

export interface WahaSessionStatusPayload {
  status: WahaSessionStatus;
}

export interface WahaMessagePayload {
  id: string;
  from: string;
  body?: string;
  timestamp: number;
  hasMedia?: boolean;
  media?: unknown;
  fromMe?: boolean;
  type?: string;
}

export interface WahaWebhookPayload {
  event: WahaWebhookEventType;
  session: string;
  payload: WahaSessionStatusPayload | WahaMessagePayload | Record<string, unknown>;
  me?: {
    id?: string;
    pushName?: string;
  };
}

export type ValidateWebhookResult =
  | { valid: true; body: WahaWebhookPayload }
  | { valid: false; reason: string };
