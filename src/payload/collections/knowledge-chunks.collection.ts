import type { CollectionConfig } from 'payload';

import { isAdmin } from '@/payload/access/is-admin.access';
import { workspaceScope } from '@/payload/access/workspace-scope.access';

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
