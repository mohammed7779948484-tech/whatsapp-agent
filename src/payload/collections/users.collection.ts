import type { CollectionConfig } from 'payload';
import { tenantsArrayField } from '@payloadcms/plugin-multi-tenant/fields';

import { isAdmin } from '../access/is-admin.access.ts';

const userTenantsField = tenantsArrayField({
  tenantsCollectionSlug: 'workspaces',
});

export const Users: CollectionConfig = {
  slug: 'users',
  admin: {
    useAsTitle: 'email',
    group: 'Authentication',
  },
  auth: {
    maxLoginAttempts: 5,
    lockTime: 600000,
    tokenExpiration: 86400,
  },
  access: {
    read: isAdmin,
    create: isAdmin,
    update: isAdmin,
    delete: isAdmin,
  },
  fields: [
    {
      name: 'role',
      type: 'select',
      required: true,
      defaultValue: 'owner',
      admin: {
        position: 'sidebar',
      },
      options: [
        { label: 'Admin', value: 'admin' },
        { label: 'Owner', value: 'owner' },
      ],
    },
    {
      ...userTenantsField,
      label: 'Workspace Access',
      maxRows: 1,
      admin: {
        position: 'sidebar',
        description: 'Assign exactly one workspace to each owner account.',
      },
      validate: (value: unknown, { siblingData }: { siblingData?: { role?: 'admin' | 'owner' } }) => {
        if (siblingData?.role !== 'owner') {
          return true;
        }

        if (!Array.isArray(value) || value.length !== 1) {
          return 'Owner users must be assigned exactly one workspace.';
        }

        return true;
      },
    },
  ],
  timestamps: true,
};
