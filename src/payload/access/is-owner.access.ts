import type { Access } from 'payload';

import type { User } from '../../payload-types.ts';

export const isOwner: Access = ({ req }) => {
  const user = req.user as User | null;
  
  if (!user) {
    return false;
  }
  
  return user.role === 'owner';
};
