import type { CollectionConfig } from 'payload';
import { DEFAULT_WORKSPACE_STATUS } from '../../shared/types/workspace-status.ts';

export const Workspaces: CollectionConfig = {
  slug: 'workspaces',
  admin: {
    useAsTitle: 'name',
    group: 'Tenant Management',
  },
  fields: [
    {
      name: 'name',
      type: 'text',
      required: true,
      admin: {
        position: 'sidebar',
      },
    },
    {
      name: 'slug',
      type: 'text',
      unique: true,
      required: true,
      admin: {
        position: 'sidebar',
        description: 'URL-safe identifier for the workspace',
      },
    },
    {
      name: 'status',
      type: 'select',
      required: true,
      defaultValue: DEFAULT_WORKSPACE_STATUS,
      options: [
        { label: 'Active', value: 'active' },
        { label: 'Paused', value: 'paused' },
        { label: 'Disabled', value: 'disabled' },
      ],
      admin: {
        position: 'sidebar',
      },
    },
  ],
  timestamps: true,
};
