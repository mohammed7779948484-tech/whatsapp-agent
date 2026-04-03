import type { CollectionConfig } from 'payload';

export const Users: CollectionConfig = {
  slug: 'users',
  admin: {
    useAsTitle: 'email',
  },
  auth: {
    maxLoginAttempts: 5,
    lockTime: 600000,
  },
  fields: [
    {
      name: 'role',
      type: 'select',
      required: true,
      defaultValue: 'owner',
      options: [
        { label: 'Admin', value: 'admin' },
        { label: 'Owner', value: 'owner' },
      ],
    },
  ],
};

export default Users;