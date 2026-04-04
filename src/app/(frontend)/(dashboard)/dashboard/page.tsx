import { getOwnerDashboardSession } from '@/core/auth/get-owner-dashboard-session';
import { getPayloadClient } from '@/payload/lib/get-payload';
import { OwnerLogoutButton } from '@/widgets/owner-logout';

export default async function DashboardPage() {
  const { user, workspaceId } = await getOwnerDashboardSession();

  const payload = await getPayloadClient();
  const workspace = await payload.findByID({
    collection: 'workspaces',
    id: workspaceId,
    overrideAccess: false,
    user,
  });

  return (
    <main className="min-h-screen bg-slate-100 px-4 py-12">
      <div className="mx-auto max-w-3xl rounded-xl border border-slate-200 bg-white p-8 shadow-sm">
        <div className="flex items-center justify-between gap-4">
          <h1 className="text-2xl font-semibold text-slate-900">Owner dashboard</h1>
          <OwnerLogoutButton />
        </div>

        <p className="mt-6 text-sm text-slate-600">Logged in owner</p>
        <p className="text-lg font-medium text-slate-900">{user.email}</p>

        <p className="mt-6 text-sm text-slate-600">Workspace</p>
        <p className="text-lg font-medium text-slate-900">{workspace.name}</p>
      </div>
    </main>
  );
}
