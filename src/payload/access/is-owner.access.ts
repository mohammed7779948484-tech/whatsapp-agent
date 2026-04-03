import type { Access } from 'payload';

export const isOwner: Access = ({ req }) => {
  const user = req.user;
  
  if (!user) {
    return false;
  }
  
  return (user as unknown as { role: string }).role === 'owner';
};