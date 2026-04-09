import type { FeatureConfig } from '@/features/_registry/types';

export const whatsappConnectionConfig: FeatureConfig = {
  id: 'whatsapp-connection',
  name: 'WhatsApp Connection',
  description: 'Provision and manage WAHA WhatsApp sessions',
  dependencies: ['modules/whatsapp'],
  enabled: true,
};
