import type { CollectionConfig } from 'payload';

import { workspaceOwnerCrud } from '../access/workspace-owner-crud.access.ts';
import { knowledgeFileAfterDelete } from '../hooks/knowledge-file-after-delete.hook.ts';
import { knowledgeFileBeforeChange } from '../hooks/knowledge-file-before-change.hook.ts';

export const KnowledgeFiles: CollectionConfig = {
  slug: 'knowledge_files',
  admin: {
    useAsTitle: 'filename',
    group: 'Tenant Data',
  },
  upload: {
    mimeTypes: ['application/pdf', 'text/csv'],
  },
  access: {
    create: workspaceOwnerCrud,
    read: workspaceOwnerCrud,
    update: workspaceOwnerCrud,
    delete: workspaceOwnerCrud,
  },
  hooks: {
    beforeChange: [knowledgeFileBeforeChange],
    afterDelete: [knowledgeFileAfterDelete],
  },
  fields: [
    {
      name: 'workspace',
      type: 'relationship',
      relationTo: 'workspaces',
      required: true,
    },
    {
      name: 'parse_status',
      type: 'select',
      required: true,
      defaultValue: 'pending',
      options: [
        { label: 'Pending', value: 'pending' },
        { label: 'Parsing', value: 'parsing' },
        { label: 'Parsed', value: 'parsed' },
        { label: 'Failed', value: 'failed' },
      ],
    },
    {
      name: 'ingestion_status',
      type: 'select',
      required: true,
      defaultValue: 'pending',
      options: [
        { label: 'Pending', value: 'pending' },
        { label: 'Processing', value: 'processing' },
        { label: 'Indexed', value: 'indexed' },
        { label: 'Failed', value: 'failed' },
      ],
    },
    {
      name: 'ingestion_error',
      type: 'textarea',
    },
    {
      name: 'uploaded_at',
      type: 'date',
      required: true,
    },
    {
      name: 'parsed_at',
      type: 'date',
    },
    {
      name: 'indexed_at',
      type: 'date',
    },
  ],
  timestamps: true,
};
