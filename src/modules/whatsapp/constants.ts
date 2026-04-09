import type { ProviderStatus, WahaSessionStatus } from './types';

export const WAHA_STATUS_MAP: Record<WahaSessionStatus, ProviderStatus> = {
  STARTING: 'disconnected',
  SCAN_QR_CODE: 'qr_pending',
  WORKING: 'connected',
  FAILED: 'error',
  STOPPED: 'disconnected',
};

export const WAHA_SESSION_NAME_PREFIX = 'workspace_';
export const WAHA_HMAC_HEADER = 'x-webhook-hmac';
export const WAHA_HMAC_ALGORITHM_HEADER = 'x-webhook-hmac-algorithm';
export const WAHA_HMAC_ALGORITHM = 'sha512';
