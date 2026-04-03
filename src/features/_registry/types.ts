export interface FeatureConfig {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
  dependencies?: string[];
}

export type FeatureRegistry = Map<string, FeatureConfig>;