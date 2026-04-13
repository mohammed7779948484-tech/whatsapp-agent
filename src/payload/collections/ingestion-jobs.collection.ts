import type { CollectionConfig } from 'payload';

import { isAdmin } from '../access/is-admin.access.ts';
import { workspaceScope } from '../access/workspace-scope.access.ts';
import { syncWorkspaceFromRelation } from '../hooks/sync-workspace-from-relation.hook.ts';

export const IngestionJobs: CollectionConfig = {
  slug: 'ingestion_jobs',
  admin: {
    group: 'Tenant Data',
  },
  access: {
    create: isAdmin,
    read: workspaceScope,
    update: isAdmin,
    delete: isAdmin,
  },
  hooks: {
    beforeChange: [syncWorkspaceFromRelation('file', 'knowledge_files')],
  },
  fields: [
    {
      name: 'workspace',
      type: 'relationship',
      relationTo: 'workspaces',
      required: true,
    },
    {
      name: 'file',
      type: 'relationship',
      relationTo: 'knowledge_files' as never,
      required: true,
    },
    {
      name: 'stage',
      type: 'select',
      required: true,
      defaultValue: 'queued',
      options: [
        { label: 'Queued', value: 'queued' },
        { label: 'Parsing', value: 'parsing' },
        { label: 'Chunking', value: 'chunking' },
        { label: 'Embedding', value: 'embedding' },
        { label: 'Indexed', value: 'indexed' },
        { label: 'Failed', value: 'failed' },
      ],
    },
    {
      name: 'attempt_count',
      type: 'number',
      required: true,
      defaultValue: 0,
    },
    {
      name: 'last_error',
      type: 'textarea',
    },
    {
      name: 'started_at',
      type: 'date',
    },
    {
      name: 'finished_at',
      type: 'date',
    },
  ],
  timestamps: true,
};
