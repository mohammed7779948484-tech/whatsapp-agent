import type { ReactNode } from 'react';

import { getOwnerDashboardSession } from '@/core/auth';

export default async function DashboardLayout({ children }: { children: ReactNode }) {
  await getOwnerDashboardSession();

  return <>{children}</>;
}
