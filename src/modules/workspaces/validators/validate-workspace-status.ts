import type { WorkspaceStatus } from '@/shared/types';

export function isActiveWorkspace(status: WorkspaceStatus): boolean {
  return status === 'active';
}
