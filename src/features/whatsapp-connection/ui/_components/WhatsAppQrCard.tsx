'use client';

import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { useEffect, useState, useTransition } from 'react';

import type { ProviderStatus } from '@/modules/whatsapp';
import type { ActionResult } from '@/shared/types';

type RefreshAction = (() => Promise<ActionResult<{ qrCode: string }>>) | null;

type WhatsAppQrCardProps = {
  qrCode: string | null;
  providerStatus: ProviderStatus | null;
  refreshAction?: RefreshAction;
};

export function WhatsAppQrCard({
  qrCode,
  providerStatus,
  refreshAction = null,
}: WhatsAppQrCardProps) {
  const router = useRouter();
  const [currentQrCode, setCurrentQrCode] = useState(qrCode);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    setCurrentQrCode(qrCode);
  }, [qrCode]);

  function handleRefresh() {
    if (!refreshAction) {
      return;
    }

    startTransition(async () => {
      setError(null);

      let result: ActionResult<{ qrCode: string }> | undefined;

      try {
        result = await refreshAction();
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error || 'Unexpected error');
        setError(message || 'Unexpected error');
        return;
      }

      if (!result?.success) {
        setError(result?.error ?? 'Unexpected error');
        return;
      }

      setCurrentQrCode(result.data.qrCode);
      router.refresh();
    });
  }

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-base font-semibold text-slate-900">QR code</h2>
        <button
          type="button"
          onClick={handleRefresh}
          disabled={!refreshAction || isPending}
          className="rounded-md border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 transition hover:border-slate-400 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isPending ? 'Refreshing...' : 'Refresh QR'}
        </button>
      </div>

      {providerStatus === 'connected' ? (
        <p className="mt-4 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
          WhatsApp is connected successfully.
        </p>
      ) : currentQrCode && providerStatus === 'qr_pending' ? (
        <div className="mt-4 flex flex-col items-center gap-3">
          <Image
            src={`data:image/png;base64,${currentQrCode}`}
            alt="WhatsApp QR code"
            className="h-64 w-64 rounded-lg border border-slate-200 bg-white object-contain p-3"
            width={256}
            height={256}
            unoptimized
          />
          <p className="text-sm text-slate-600">Scan this QR code using the WhatsApp mobile app.</p>
        </div>
      ) : (
        <p className="mt-4 text-sm text-slate-600">
          Provision a session to fetch the latest QR code for this workspace.
        </p>
      )}

      {error ? (
        <p className="mt-4 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
          {error}
        </p>
      ) : null}
    </div>
  );
}
