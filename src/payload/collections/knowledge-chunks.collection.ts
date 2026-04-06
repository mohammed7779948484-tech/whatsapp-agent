import type { CollectionConfig } from 'payload';

import { isAdmin } from '../access/is-admin.access.ts';
import { workspaceScope } from '../access/workspace-scope.access.ts';
import { syncWorkspaceFromRelation } from '../hooks/sync-workspace-from-relation.hook.ts';

export const KnowledgeChunks: CollectionConfig = {
  slug: 'knowledge_chunks',
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
      name: 'chunk_index',
      type: 'number',
      required: true,
    },
    {
      name: 'content',
      type: 'textarea',
      required: true,
    },
    {
      name: 'content_hash',
      type: 'text',
      required: true,
    },
    {
      name: 'metadata_json',
      type: 'json',
    },
  ],
  timestamps: true,
};
