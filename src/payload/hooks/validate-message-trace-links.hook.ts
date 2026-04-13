import type { CollectionBeforeChangeHook } from 'payload';

import { AppError } from '../../core/errors/app-error.ts';
import { ErrorCode } from '../../core/errors/error-codes.ts';

interface RelationLike {
  id?: unknown;
  workspace?: unknown;
  conversation?: unknown;
}

interface TraceData {
  workspace?: unknown;
  conversation?: unknown;
  inbound_message?: unknown;
  outbound_message?: unknown;
}

function resolveRelationshipId(value: unknown): number | null {
  if (typeof value === 'number') {
    return value;
  }

  if (value && typeof value === 'object' && 'id' in value) {
    const relationId = (value as RelationLike).id;
    return typeof relationId === 'number' ? relationId : null;
  }

  return null;
}

function resolveWorkspaceId(value: unknown): number | null {
  if (typeof value === 'number') {
    return value;
  }

  if (value && typeof value === 'object' && 'workspace' in value) {
    return resolveRelationshipId((value as RelationLike).workspace);
  }

  return resolveRelationshipId(value);
}

export const validateMessageTraceLinks: CollectionBeforeChangeHook = async ({ data, originalDoc, req }) => {
  const nextData = (data && typeof data === 'object' ? data : {}) as TraceData;
  const originalData =
    (originalDoc && typeof originalDoc === 'object' ? originalDoc : {}) as TraceData;
  const conversationId =
    resolveRelationshipId(nextData.conversation) ?? resolveRelationshipId(originalData.conversation);
  const inboundMessageId =
    resolveRelationshipId(nextData.inbound_message) ??
    resolveRelationshipId(originalData.inbound_message);
  const outboundMessageId =
    resolveRelationshipId(nextData.outbound_message) ??
    resolveRelationshipId(originalData.outbound_message);

  if (!conversationId || !inboundMessageId) {
    return data;
  }

  const conversation = await req.payload.findByID({
    collection: 'conversations' as never,
    id: conversationId,
    depth: 0,
    overrideAccess: true,
    req,
  });

  const inboundMessage = await req.payload.findByID({
    collection: 'messages' as never,
    id: inboundMessageId,
    depth: 0,
    overrideAccess: true,
    req,
  });

  const outboundMessage = outboundMessageId
    ? await req.payload.findByID({
        collection: 'messages' as never,
        id: outboundMessageId,
        depth: 0,
        overrideAccess: true,
        req,
      })
    : null;

  const workspaceId = resolveWorkspaceId(conversation);
  const inboundWorkspaceId = resolveWorkspaceId(inboundMessage);
  const outboundWorkspaceId = outboundMessage ? resolveWorkspaceId(outboundMessage) : workspaceId;
  const inboundConversationId = resolveRelationshipId((inboundMessage as RelationLike).conversation);
  const outboundConversationId = outboundMessage
    ? resolveRelationshipId((outboundMessage as RelationLike).conversation)
    : conversationId;

  const hasMismatch =
    !workspaceId ||
    inboundWorkspaceId !== workspaceId ||
    outboundWorkspaceId !== workspaceId ||
    inboundConversationId !== conversationId ||
    outboundConversationId !== conversationId;

  if (hasMismatch) {
    throw new AppError(
      'Message trace relationships must belong to the same workspace and conversation',
      ErrorCode.VALIDATION_ERROR,
      400
    );
  }

  return {
    ...nextData,
    workspace: workspaceId,
  };
};
