import Link from 'next/link';

import type { ProviderStatus } from '@/modules/whatsapp';
import type { WhatsappSession } from '@/payload-types';

type WhatsAppStatusWidgetProps = {
  session: WhatsappSession | null;
  statusLabels: Record<ProviderStatus, string>;
  statusColors: Record<ProviderStatus, string>;
};

export function WhatsAppStatusWidget({
  session,
  statusLabels,
  statusColors,
}: WhatsAppStatusWidgetProps) {
  if (!session) {
    return (
      <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-sm text-slate-600">WhatsApp connection</p>
            <p className="mt-2 text-lg font-medium text-slate-900">Not configured</p>
            <p className="mt-1 text-sm text-slate-600">
              Connect your workspace number to start receiving WhatsApp messages.
            </p>
          </div>

          <Link
            href="/whatsapp"
            className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-slate-400 hover:bg-slate-50"
          >
            Set up
          </Link>
        </div>
      </section>
    );
  }

  const badgeClass = statusColors[session.provider_status];
  const badgeLabel = statusLabels[session.provider_status];

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-sm text-slate-600">WhatsApp connection</p>
          <div className="mt-2 flex items-center gap-3">
            <span className={`rounded-full border px-3 py-1 text-xs font-medium ${badgeClass}`}>
              {badgeLabel}
            </span>
            {session.connected_phone ? (
              <span className="text-sm text-slate-700">{session.connected_phone}</span>
            ) : null}
          </div>
        </div>

        <Link
          href="/whatsapp"
          className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-slate-400 hover:bg-slate-50"
        >
          {session.provider_status === 'connected'
            ? 'Manage'
            : session.provider_status === 'disconnected'
              ? 'Reconnect'
              : 'Open'}
        </Link>
      </div>

      {session.provider_status === 'connected' && session.last_synced_at ? (
        <p className="mt-4 text-sm text-slate-600">
          Last synced: {new Date(session.last_synced_at).toLocaleString()}
        </p>
      ) : null}

      {session.provider_status === 'qr_pending' ? (
        <p className="mt-4 text-sm text-slate-600">
          Awaiting scan. Open the WhatsApp connection page to view the latest QR code.
        </p>
      ) : null}

      {session.provider_status === 'error' ? (
        <p className="mt-4 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
          {session.last_error?.slice(0, 160) ?? 'An unknown connection error occurred.'}
        </p>
      ) : null}
    </section>
  );
}
