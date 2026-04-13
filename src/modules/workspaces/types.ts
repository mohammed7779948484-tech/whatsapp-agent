import type { WorkspaceStatus } from '@/shared/types';

export type WorkspaceGateResult =
  | { allowed: true }
  | { allowed: false; reason: Exclude<WorkspaceStatus, 'active'>; replyText: string };
