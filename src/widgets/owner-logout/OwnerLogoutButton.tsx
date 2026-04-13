'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

export function OwnerLogoutButton() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);

  async function handleLogout() {
    setIsLoading(true);

    try {
      await fetch('/api/users/logout', {
        method: 'POST',
        credentials: 'include',
      });
    } finally {
      router.replace('/login');
      router.refresh();
      setIsLoading(false);
    }
  }

  return (
    <button
      type="button"
      onClick={handleLogout}
      disabled={isLoading}
      className="rounded-md border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 transition hover:border-slate-400 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
    >
      {isLoading ? 'Signing out...' : 'Sign out'}
    </button>
  );
}
