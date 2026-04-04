import type { CollectionConfig } from 'payload';

import { isAdmin } from '../access/is-admin.access.ts';
import { workspaceScope } from '../access/workspace-scope.access.ts';

export const Conversations: CollectionConfig = {
  slug: 'conversations',
  admin: {
    useAsTitle: 'remote_jid',
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
      name: 'remote_jid',
      type: 'text',
      required: true,
    },
    {
      name: 'session_started_at',
      type: 'date',
      required: true,
    },
    {
      name: 'last_message_at',
      type: 'date',
      required: true,
    },
    {
      name: 'status',
      type: 'select',
      required: true,
      defaultValue: 'open',
      options: [
        { label: 'Open', value: 'open' },
        { label: 'Closed', value: 'closed' },
      ],
    },
  ],
  timestamps: true,
};
