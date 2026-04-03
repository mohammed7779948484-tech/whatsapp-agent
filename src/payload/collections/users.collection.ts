import type { CollectionConfig } from 'payload';
import { isAdmin } from '../access/is-admin.access';

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
  ],
  timestamps: true,
};