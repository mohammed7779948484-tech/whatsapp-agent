import type { CollectionConfig } from 'payload';

import { isAdmin } from '../access/is-admin.access.ts';
import { workspaceOwnerCrud } from '../access/workspace-owner-crud.access.ts';
import { workspaceScope } from '../access/workspace-scope.access.ts';
import { enforceOnePerWorkspace } from '../hooks/enforce-one-per-workspace.hook.ts';

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
    beforeChange: [enforceOnePerWorkspace('agents')],
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
