import type { Access } from 'payload';

import type { User } from '@/payload-types';

export const isAdminOrSelf: Access = ({ req }) => {
  const user = req.user as User | null;

  if (!user) {
    return false;
  }

  if (user.role === 'admin') {
    return true;
  }

  return {
    id: {
      equals: user.id,
    },
  };
};
