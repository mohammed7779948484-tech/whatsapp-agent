import type { FeatureConfig } from '@/features/_registry/types';

export const authLoginConfig: FeatureConfig = {
  id: 'auth-login',
  name: 'Auth Login',
  description: 'Owner login form and related UI for foundation authentication.',
  enabled: true,
  dependencies: [],
};
