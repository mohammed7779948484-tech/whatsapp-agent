import { AppError, ErrorCode } from '@/core/errors';
import { createLogger } from '@/core/logger';
import { getSystemReply, localeFromText } from '@/shared/lib';
import type { SupportedLocale } from '@/shared/types';
import type { Agent, User, Workspace } from '@/payload-types';
import type { Payload } from 'payload';

import type { WorkspaceGateResult } from '../types';
import { isActiveWorkspace } from '../validators/validate-workspace-status';

function isSupportedLocale(value: SupportedLocale | null | undefined): value is SupportedLocale {
  return value === 'ar' || value === 'en';
}

export function resolveReplyLocale(
  agentLanguagePreference: SupportedLocale | null | undefined,
  inboundText: string
): SupportedLocale {
  if (isSupportedLocale(agentLanguagePreference)) {
    return agentLanguagePreference;
  }

  return localeFromText(inboundText);
}

export class WorkspacesService {
  private readonly logger = createLogger('modules/workspaces/service');

  public resolveReplyLocale(
    agentLanguagePreference: SupportedLocale | null | undefined,
    inboundText: string
  ): SupportedLocale {
    return resolveReplyLocale(agentLanguagePreference, inboundText);
  }

  public async checkStatusGate(
    workspaceId: string | number,
    payload: Payload,
    inboundText: string = ''
  ): Promise<WorkspaceGateResult> {
    const workspace = (await payload.findByID({
      collection: 'workspaces',
      id: workspaceId,
      overrideAccess: true,
      depth: 0,
    })) as Workspace;

    if (isActiveWorkspace(workspace.status)) {
      return { allowed: true };
    }

    const agentResult = await payload.find({
      collection: 'agents',
      where: {
        workspace: {
          equals: workspaceId,
        },
      },
      limit: 1,
      overrideAccess: true,
      depth: 0,
    });

    const agent = (agentResult.docs[0] as Agent | undefined) ?? null;
    const locale = this.resolveReplyLocale(agent?.language_preference ?? null, inboundText);
    const replyText = getSystemReply('UNAVAILABLE_REPLY', locale);
    const reason = workspace.status === 'paused' ? 'paused' : 'disabled';

    this.logger.info('Workspace status gate blocked inbound processing', {
      workspaceId,
      status: workspace.status,
      locale,
    });

    return {
      allowed: false,
      reason,
      replyText,
    };
  }

  public async getWorkspaceForOwner(
    workspaceId: string | number,
    payload: Payload,
    user: User
  ): Promise<Workspace> {
    const workspace = (await payload.findByID({
      collection: 'workspaces',
      id: workspaceId,
      user,
      overrideAccess: false,
      depth: 0,
    })) as Workspace | null;

    if (!workspace) {
      throw new AppError('Workspace not found', ErrorCode.WORKSPACE_NOT_FOUND, 404, 'medium');
    }

    return workspace;
  }
}
