import { getOwnerDashboardSession } from '@/core/auth';
import { WhatsAppService } from '@/modules/whatsapp';
import { WhatsAppStatusWidget } from '@/widgets/whatsapp-status';

import { PROVIDER_STATUS_COLORS, PROVIDER_STATUS_LABELS } from '../constants';

export async function WhatsAppDashboardSummary() {
  const { user, workspaceId } = await getOwnerDashboardSession();
  const session = await new WhatsAppService().getSessionForWorkspace(workspaceId, user);

  return (
    <WhatsAppStatusWidget
      session={session}
      statusLabels={PROVIDER_STATUS_LABELS}
      statusColors={PROVIDER_STATUS_COLORS}
    />
  );
}
