import { describe, expect, it } from 'vitest';

import { workspaceOwnerCrud } from '../../../src/payload/access/workspace-owner-crud.access';
import { resolveUserWorkspaceId } from '../../../src/payload/access/workspace-scope.access';
import { Messages } from '../../../src/payload/collections/messages.collection';

describe('payload access helpers', () => {
  it('resolves workspace id from plugin tenant first', () => {
    const workspaceId = resolveUserWorkspaceId({
      id: 1,
      role: 'owner',
      tenant: 42,
      tenants: [{ tenant: 99 }],
      updatedAt: '',
      createdAt: '',
      email: 'owner@example.com',
      collection: 'users',
    });

    expect(workspaceId).toBe(42);
  });

  it('returns a workspace filter for owner read operations', () => {
    const result = workspaceOwnerCrud({
      req: {
        user: {
          id: 1,
          role: 'owner',
          tenant: 12,
          updatedAt: '',
          createdAt: '',
          email: 'owner@example.com',
          collection: 'users',
        },
      },
    } as never);

    expect(result).toEqual({
      workspace: {
        equals: 12,
      },
    });
  });
});

describe('messages text validation', () => {
  const textField = Messages.fields.find(
    (field) => 'name' in field && field.name === 'text'
  );

  it('requires text content for text messages only', () => {
    if (!textField || !('validate' in textField) || typeof textField.validate !== 'function') {
      throw new Error('Text field validate function not found');
    }

    expect(textField.validate('', { siblingData: { message_type: 'text' } } as never)).toBe(
      'Text content is required when message type is text.'
    );

    expect(textField.validate('', { siblingData: { message_type: 'image' } } as never)).toBe(true);
    expect(textField.validate('caption', { siblingData: { message_type: 'image' } } as never)).toBe(
      true
    );
  });
});
