import { authLoginConfig } from '@/features/auth-login';

import type { FeatureRegistry, FeatureConfig } from './types';

export const featureRegistry: FeatureRegistry = new Map([[authLoginConfig.id, authLoginConfig]]);

export function registerFeature(config: FeatureConfig): void {
  featureRegistry.set(config.id, config);
}

export function getFeature(id: string): FeatureConfig | undefined {
  return featureRegistry.get(id);
}

export function isFeatureEnabled(id: string): boolean {
  const feature = featureRegistry.get(id);
  return feature?.enabled ?? false;
}
