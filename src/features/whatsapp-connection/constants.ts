import type { ProviderStatus } from '@/modules/whatsapp';

export const PROVIDER_STATUS_LABELS: Record<ProviderStatus, string> = {
  connected: 'Connected',
  disconnected: 'Disconnected',
  qr_pending: 'QR Pending',
  error: 'Error',
};

export const PROVIDER_STATUS_COLORS: Record<ProviderStatus, string> = {
  connected: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  disconnected: 'bg-slate-100 text-slate-700 border-slate-200',
  qr_pending: 'bg-amber-100 text-amber-700 border-amber-200',
  error: 'bg-rose-100 text-rose-700 border-rose-200',
};
