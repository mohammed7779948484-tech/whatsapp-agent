import type { CollectionBeforeChangeHook, CollectionConfig } from 'payload';

import { AppError, ErrorCode } from '@/core/errors';
import type { User } from '@/payload-types';

import { isAdmin } from '../access/is-admin.access.ts';
import { workspaceOwnerCrud } from '../access/workspace-owner-crud.access.ts';
import { workspaceScope } from '../access/workspace-scope.access.ts';
import { enforceOnePerWorkspace } from '../hooks/enforce-one-per-workspace.hook.ts';

interface WorkspaceDoc {
  workspace?: number | { id?: number } | null;
}

function resolveWorkspaceId(value: WorkspaceDoc['workspace']): number | null {
  if (typeof value === 'number') {
    return value;
  }

  if (value && typeof value === 'object' && typeof value.id === 'number') {
    return value.id;
  }

  return null;
}

const preventWorkspaceChange: CollectionBeforeChangeHook = ({ data, originalDoc, req }) => {
  const user = req.user as User | null;

  if (user?.role === 'admin') {
    return data;
  }

  const incomingWorkspaceId = resolveWorkspaceId((data as WorkspaceDoc | undefined)?.workspace);
  const originalWorkspaceId = resolveWorkspaceId((originalDoc as WorkspaceDoc | undefined)?.workspace);

  if (
    typeof (data as WorkspaceDoc | undefined)?.workspace !== 'undefined' &&
    incomingWorkspaceId !== originalWorkspaceId
  ) {
    throw new AppError(
      'Only admins can change an agent workspace',
      ErrorCode.AUTHORIZATION_ERROR,
      403,
      'medium'
    );
  }

  return data;
};

export const Agents: CollectionConfig = {
  slug: 'agents',
  admin: {
    useAsTitle: 'display_name',
    group: 'Tenant Data',
  },
  access: {
    create: isAdmin,
    read: workspaceScope,
    update: workspaceOwnerCrud,
    delete: isAdmin,
  },
  hooks: {
    beforeChange: [preventWorkspaceChange, enforceOnePerWorkspace('agents')],
  },
  fields: [
    {
      name: 'workspace',
      type: 'relationship',
      relationTo: 'workspaces',
      required: true,
    },
    {
      name: 'display_name',
      type: 'text',
      required: true,
    },
    {
      name: 'response_style',
      type: 'textarea',
    },
    {
      name: 'system_prompt',
      type: 'textarea',
    },
    {
      name: 'quick_instructions',
      type: 'textarea',
    },
    {
      name: 'language_preference',
      type: 'select',
      options: [
        { label: 'Arabic', value: 'ar' },
        { label: 'English', value: 'en' },
      ],
    },
    {
      name: 'is_enabled',
      type: 'checkbox',
      required: true,
      defaultValue: true,
    },
  ],
  timestamps: true,
};
