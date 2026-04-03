import type { Access } from 'payload';

export const isAdmin: Access = ({ req }) => {
  const user = req.user;
  
  if (!user) {
    return false;
  }
  
  return (user as unknown as { role: string }).role === 'admin';
};