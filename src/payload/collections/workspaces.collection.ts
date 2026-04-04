import type { CollectionConfig } from 'payload';

import { canReadOwnWorkspace } from '@/payload/access/can-read-own-workspace.access';
import { isAdmin } from '@/payload/access/is-admin.access';
import { DEFAULT_WORKSPACE_STATUS } from '@/shared/types/workspace-status';

const WORKSPACE_SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export const Workspaces: CollectionConfig = {
  slug: 'workspaces',
  admin: {
    useAsTitle: 'name',
    group: 'Tenant Management',
  },
  access: {
    read: canReadOwnWorkspace,
    create: isAdmin,
    update: isAdmin,
    delete: isAdmin,
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
      validate: (value: unknown) => {
        if (typeof value !== 'string' || !WORKSPACE_SLUG_PATTERN.test(value)) {
          return 'Slug must be lowercase kebab-case.';
        }

        return true;
      },
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
