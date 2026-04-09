'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';

import { disconnectWhatsappSessionAction } from '../../actions/disconnect-whatsapp-session.action';
import { provisionWhatsappSessionAction } from '../../actions/provision-whatsapp-session.action';

type WhatsAppConnectionActionsProps = {
  hasSession: boolean;
};

export function WhatsAppConnectionActions({ hasSession }: WhatsAppConnectionActionsProps) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function runAction(action: () => Promise<{ success: boolean; error?: string }>) {
    startTransition(async () => {
      setError(null);

      let result: { success: boolean; error?: string };

      try {
        result = await action();
      } catch (error) {
        console.error(error);
        setError(error instanceof Error ? error.message : 'Something went wrong');
        return;
      }

      if (!result.success) {
        setError(result.error ?? 'Something went wrong');
        return;
      }

      router.refresh();
    });
  }

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex flex-wrap gap-3">
        {hasSession ? (
          <button
            type="button"
            onClick={() => runAction(disconnectWhatsappSessionAction)}
            disabled={isPending}
            className="rounded-md border border-rose-300 px-4 py-2 text-sm font-medium text-rose-700 transition hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isPending ? 'Working...' : 'Disconnect'}
          </button>
        ) : (
          <button
            type="button"
            onClick={() => runAction(provisionWhatsappSessionAction)}
            disabled={isPending}
            className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isPending ? 'Working...' : 'Provision Session'}
          </button>
        )}
      </div>

      {error ? (
        <p className="mt-4 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
          {error}
        </p>
      ) : null}
    </div>
  );
}
