import type { ProviderStatus } from '@/modules/whatsapp';

import { PROVIDER_STATUS_LABELS } from '../constants';

type WhatsAppDashboardSummaryProps = {
  providerStatus: ProviderStatus | null;
};

export function WhatsAppDashboardSummary({ providerStatus }: WhatsAppDashboardSummaryProps) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <p className="text-sm text-slate-600">WhatsApp connection</p>
      <p className="mt-2 text-lg font-medium text-slate-900">
        {providerStatus ? PROVIDER_STATUS_LABELS[providerStatus] : 'Not provisioned'}
      </p>
    </div>
  );
}
