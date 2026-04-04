import type { CollectionConfig } from 'payload';

import { isAdmin } from '../access/is-admin.access.ts';
import { workspaceScope } from '../access/workspace-scope.access.ts';
import { enforceOnePerWorkspace } from '../hooks/enforce-one-per-workspace.hook.ts';

export const WhatsappSessions: CollectionConfig = {
  slug: 'whatsapp_sessions',
  admin: {
    useAsTitle: 'session_name',
    group: 'Tenant Data',
  },
  access: {
    create: isAdmin,
    read: workspaceScope,
    update: isAdmin,
    delete: isAdmin,
  },
  hooks: {
    beforeChange: [enforceOnePerWorkspace('whatsapp_sessions')],
  },
  fields: [
    {
      name: 'workspace',
      type: 'relationship',
      relationTo: 'workspaces',
      required: true,
    },
    {
      name: 'session_name',
      type: 'text',
      required: true,
    },
    {
      name: 'provider_status',
      type: 'select',
      required: true,
      defaultValue: 'disconnected',
      options: [
        { label: 'Connected', value: 'connected' },
        { label: 'Disconnected', value: 'disconnected' },
        { label: 'QR Pending', value: 'qr_pending' },
        { label: 'Error', value: 'error' },
      ],
    },
    {
      name: 'qr_code',
      type: 'textarea',
    },
    {
      name: 'connected_phone',
      type: 'text',
    },
    {
      name: 'last_synced_at',
      type: 'date',
    },
    {
      name: 'last_error',
      type: 'textarea',
    },
  ],
  timestamps: true,
};
