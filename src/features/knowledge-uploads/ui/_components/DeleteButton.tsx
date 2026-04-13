'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';

import { deleteKnowledgeFile } from '../../actions/delete-knowledge-file.action';

interface DeleteButtonProps {
  fileId: number;
}

export function DeleteButton({ fileId }: DeleteButtonProps) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const handleDelete = () => {
    const confirmed = window.confirm('Delete this file? This will remove all associated knowledge.');

    if (!confirmed) {
      return;
    }

    setError(null);

    startTransition(async () => {
      const result = await deleteKnowledgeFile(fileId);

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
        onClick={handleDelete}
        disabled={isPending}
        className="rounded-md border border-rose-300 px-3 py-2 text-sm font-medium text-rose-700 transition hover:border-rose-400 hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isPending ? 'Deleting...' : 'Delete'}
      </button>

      {error ? <p className="text-xs text-rose-700">{error}</p> : null}
    </div>
  );
}
