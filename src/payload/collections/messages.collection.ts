import type { CollectionConfig } from 'payload';

import { isAdmin } from '../access/is-admin.access.ts';
import { workspaceScope } from '../access/workspace-scope.access.ts';

export const Messages: CollectionConfig = {
  slug: 'messages',
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
      name: 'conversation',
      type: 'relationship',
      relationTo: 'conversations' as never,
      required: true,
    },
    {
      name: 'direction',
      type: 'select',
      required: true,
      options: [
        { label: 'Inbound', value: 'inbound' },
        { label: 'Outbound', value: 'outbound' },
      ],
    },
    {
      name: 'provider_message_id',
      type: 'text',
    },
    {
      name: 'text',
      type: 'textarea',
      validate: (value, { siblingData }) => {
        const messageType =
          (siblingData as { message_type?: string } | undefined)?.message_type ?? 'text';

        if (messageType !== 'text') {
          return true;
        }

        if (typeof value === 'string' && value.trim().length > 0) {
          return true;
        }

        return 'Text content is required when message type is text.';
      },
    },
    {
      name: 'message_type',
      type: 'select',
      required: true,
      defaultValue: 'text',
      options: [
        { label: 'Text', value: 'text' },
        { label: 'Image', value: 'image' },
        { label: 'Audio', value: 'audio' },
        { label: 'Video', value: 'video' },
        { label: 'Document', value: 'document' },
        { label: 'Other', value: 'other' },
      ],
    },
    {
      name: 'delivery_status',
      type: 'select',
      options: [
        { label: 'Sent', value: 'sent' },
        { label: 'Delivered', value: 'delivered' },
        { label: 'Read', value: 'read' },
        { label: 'Failed', value: 'failed' },
      ],
    },
  ],
  timestamps: true,
};
