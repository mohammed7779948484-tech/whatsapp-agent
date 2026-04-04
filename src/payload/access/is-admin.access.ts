import type { Access } from 'payload';

import type { User } from '@/payload-types';

export const isAdmin: Access = ({ req }) => {
  const user = req.user as User | null;
  
  if (!user) {
    return false;
  }
  
  return user.role === 'admin';
};
