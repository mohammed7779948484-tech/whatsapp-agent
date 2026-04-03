import type { ReactNode } from 'react';

import { getOwnerDashboardSession } from '@/core/auth/get-owner-dashboard-session';

export default async function DashboardLayout({ children }: { children: ReactNode }) {
  await getOwnerDashboardSession();

  return <>{children}</>;
}
