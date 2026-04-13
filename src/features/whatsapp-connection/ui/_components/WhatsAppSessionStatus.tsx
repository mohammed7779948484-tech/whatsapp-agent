import type { ProviderStatus } from '@/modules/whatsapp';

import { PROVIDER_STATUS_COLORS, PROVIDER_STATUS_LABELS } from '../../constants';

type WhatsAppSessionStatusProps = {
  status: ProviderStatus | null;
  connectedPhone?: string | null;
  lastSyncedAt?: string | null;
  lastError?: string | null;
};

export function WhatsAppSessionStatus({
  status,
  connectedPhone,
  lastSyncedAt,
  lastError,
}: WhatsAppSessionStatusProps) {
  if (!status) {
    return (
      <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-4 text-sm text-slate-600">
        No WhatsApp session has been provisioned yet.
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-base font-semibold text-slate-900">Connection status</h2>
        <span
          className={`rounded-full border px-3 py-1 text-xs font-medium ${PROVIDER_STATUS_COLORS[status]}`}
        >
          {PROVIDER_STATUS_LABELS[status]}
        </span>
      </div>

      {connectedPhone ? (
        <p className="mt-4 text-sm text-slate-700">
          Connected phone: <span className="font-medium text-slate-900">{connectedPhone}</span>
        </p>
      ) : null}

      {lastSyncedAt ? (
        <p className="mt-2 text-sm text-slate-600">Last synced: {new Date(lastSyncedAt).toLocaleString()}</p>
      ) : null}

      {status === 'error' && lastError ? (
        <p className="mt-4 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
          {lastError}
        </p>
      ) : null}
    </div>
  );
}
