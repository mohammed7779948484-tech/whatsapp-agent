export type WorkspaceStatus = 'active' | 'paused' | 'disabled';

export const WorkspaceStatusLabels: Record<WorkspaceStatus, string> = {
  active: 'Active',
  paused: 'Paused',
  disabled: 'Disabled',
};

export const WorkspaceStatusDescriptions: Record<WorkspaceStatus, string> = {
  active: 'AI replies normally',
  paused: 'Fixed maintenance reply',
  disabled: 'Hard administrative shutdown',
};

export const DEFAULT_WORKSPACE_STATUS: WorkspaceStatus = 'active';