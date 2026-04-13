'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';

import { retryIngestion } from '../../actions/retry-ingestion.action';

interface RetryButtonProps {
  fileId: number;
}

export function RetryButton({ fileId }: RetryButtonProps) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const handleRetry = () => {
    setError(null);

    startTransition(async () => {
      const result = await retryIngestion(fileId);

      if (!result.success) {
        setError(result.error);
        return;
      }

      router.refresh();
    });
  };

  return (
    <div className="flex flex-col items-start gap-2">
      <button
        type="button"
        onClick={handleRetry}
        disabled={isPending}
        className="rounded-md border border-amber-300 px-3 py-2 text-sm font-medium text-amber-700 transition hover:border-amber-400 hover:bg-amber-50 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isPending ? 'Retrying...' : 'Retry'}
      </button>

      {error ? <p className="text-xs text-rose-700">{error}</p> : null}
    </div>
  );
}
