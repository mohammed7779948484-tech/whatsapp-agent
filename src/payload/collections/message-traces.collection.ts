import type { CollectionConfig } from 'payload';

import { tracesAdminOnly } from '../access/traces-admin-only.access.ts';

export const MessageTraces: CollectionConfig = {
  slug: 'message_traces',
  admin: {
    group: 'Admin Only',
  },
  access: {
    create: tracesAdminOnly,
    read: tracesAdminOnly,
    update: tracesAdminOnly,
    delete: tracesAdminOnly,
  },
  fields: [
    {
      name: 'workspace',
      type: 'relationship',
      relationTo: 'workspaces',
      required: true,
    },
    {
      name: 'conversation',
      type: 'relationship',
      relationTo: 'conversations' as never,
      required: true,
    },
    {
      name: 'inbound_message',
      type: 'relationship',
      relationTo: 'messages' as never,
      required: true,
    },
    {
      name: 'outbound_message',
      type: 'relationship',
      relationTo: 'messages' as never,
    },
    {
      name: 'prompt_snapshot',
      type: 'textarea',
    },
    {
      name: 'retrieved_chunks_snapshot',
      type: 'json',
    },
    {
      name: 'model_name',
      type: 'text',
    },
    {
      name: 'used_fallback',
      type: 'checkbox',
      required: true,
      defaultValue: false,
    },
    {
      name: 'fallback_reason',
      type: 'text',
    },
    {
      name: 'send_status',
      type: 'select',
      options: [
        { label: 'Sent', value: 'sent' },
        { label: 'Failed', value: 'failed' },
      ],
    },
    {
      name: 'error_details',
      type: 'textarea',
    },
  ],
  timestamps: true,
};
