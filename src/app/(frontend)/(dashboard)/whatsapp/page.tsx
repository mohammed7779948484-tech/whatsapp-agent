import type { Metadata } from 'next';

import { WhatsAppConnectionPage } from '@/features/whatsapp-connection';

export const metadata: Metadata = {
  title: 'WhatsApp Connection',
};

export default function WhatsAppPage() {
  return <WhatsAppConnectionPage />;
}
