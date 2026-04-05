import type { CollectionConfig } from 'payload';
import { tenantsArrayField } from '@payloadcms/plugin-multi-tenant/fields';

import type { User } from '@/payload-types';
import { SESSION_MAX_AGE } from '@/core/auth/constants';

import { isAdmin } from '@/payload/access/is-admin.access';
import { isAdminOrSelf } from '@/payload/access/is-admin-or-self.access';

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
    tokenExpiration: SESSION_MAX_AGE,
  },
  access: {
    admin: ({ req }) => (req.user as User | null)?.role === 'admin',
    read: isAdminOrSelf,
    create: isAdmin,
    update: isAdminOrSelf,
    delete: isAdmin,
  },
  fields: [
    {
      name: 'role',
      type: 'select',
      required: true,
      defaultValue: 'owner',
      access: {
        create: ({ req }) => (req.user as User | null)?.role === 'admin',
        update: ({ req }) => (req.user as User | null)?.role === 'admin',
      },
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
      access: {
        create: ({ req }) => (req.user as User | null)?.role === 'admin',
        update: ({ req }) => (req.user as User | null)?.role === 'admin',
      },
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
