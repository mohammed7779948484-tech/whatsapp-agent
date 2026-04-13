import type { Metadata } from 'next';

import { KnowledgeUploadsPage } from '@/features/knowledge-uploads';

export const metadata: Metadata = {
  title: 'Knowledge Base',
};

export default function KnowledgePage() {
  return <KnowledgeUploadsPage />;
}
