import type { FeatureConfig } from '@/features/_registry/types';

import { KNOWLEDGE_UPLOADS_FEATURE_ID } from './constants';

export const knowledgeUploadsConfig: FeatureConfig = {
  id: KNOWLEDGE_UPLOADS_FEATURE_ID,
  name: 'Knowledge Uploads',
  description: 'Owner-facing knowledge file upload, listing, retry, deletion, and freshness surfaces.',
  dependencies: ['modules/knowledge'],
  enabled: true,
};
