import { getOwnerDashboardSession } from '@/core/auth';
import { KnowledgeDashboardSummary } from '@/features/knowledge-uploads';
import { WhatsAppDashboardSummary } from '@/features/whatsapp-connection';
import { OwnerLogoutButton } from '@/widgets/owner-logout';

export default async function DashboardPage() {
  const { user, workspaceId } = await getOwnerDashboardSession();

  return (
    <main className="min-h-screen bg-slate-100 px-4 py-12">
      <div className="mx-auto max-w-4xl space-y-6">
        <div className="rounded-xl border border-slate-200 bg-white p-8 shadow-sm">
        <div className="flex items-center justify-between gap-4">
          <h1 className="text-2xl font-semibold text-slate-900">Owner dashboard</h1>
          <OwnerLogoutButton />
        </div>

        <p className="mt-6 text-sm text-slate-600">Logged in owner</p>
        <p className="text-lg font-medium text-slate-900">{user.email}</p>

        <p className="mt-6 text-sm text-slate-600">Workspace</p>
        <p className="text-lg font-medium text-slate-900">Workspace #{workspaceId}</p>
        </div>

        <WhatsAppDashboardSummary />
        <KnowledgeDashboardSummary />
      </div>
    </main>
  );
}
