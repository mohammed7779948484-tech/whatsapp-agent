import { getOwnerDashboardSession } from '@/core/auth';
import { WhatsAppService } from '@/modules/whatsapp';

import { refreshWhatsappQrAction } from '../actions/refresh-whatsapp-qr.action';
import { WhatsAppConnectionActions } from './_components/WhatsAppConnectionActions';
import { WhatsAppQrCard } from './_components/WhatsAppQrCard';
import { WhatsAppSessionStatus } from './_components/WhatsAppSessionStatus';

export async function WhatsAppConnectionPage() {
  const { user, workspaceId } = await getOwnerDashboardSession();
  const session = await new WhatsAppService().getSessionForWorkspace(workspaceId, user);

  return (
    <main className="min-h-screen bg-slate-100 px-4 py-12">
      <div className="mx-auto max-w-4xl space-y-6">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">WhatsApp Connection</h1>
          <p className="mt-2 text-sm text-slate-600">
            Provision a WAHA session, view its QR code, and manage the workspace connection.
          </p>
        </div>

        <WhatsAppSessionStatus
          status={session?.provider_status ?? null}
          connectedPhone={session?.connected_phone}
          lastSyncedAt={session?.last_synced_at}
          lastError={session?.last_error}
        />

        <WhatsAppQrCard
          qrCode={session?.qr_code ?? null}
          providerStatus={session?.provider_status ?? null}
          refreshAction={session ? refreshWhatsappQrAction : null}
        />

        <WhatsAppConnectionActions hasSession={Boolean(session)} />
      </div>
    </main>
  );
}
