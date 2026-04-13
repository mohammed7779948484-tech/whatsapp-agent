import { verifySignatureAppRouter } from '@upstash/qstash/nextjs';
import { NextResponse } from 'next/server';

import { createLogger } from '@/core/logger';
import { KnowledgeService } from '@/modules/knowledge';

const logger = createLogger('api/jobs/ingest-parse');

function getNumericPayloadValue(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

async function handler(request: Request) {
  try {
    const body = (await request.json()) as { fileId?: unknown; workspaceId?: unknown };
    const fileId = getNumericPayloadValue(body.fileId);
    const workspaceId = getNumericPayloadValue(body.workspaceId);

    if (fileId === null || workspaceId === null) {
      return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
    }

    await new KnowledgeService().parseFile(fileId, workspaceId);

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error) {
    logger.error(
      'Knowledge parse job failed',
      undefined,
      error instanceof Error ? error : undefined
    );

    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}

export const POST = verifySignatureAppRouter(handler);
