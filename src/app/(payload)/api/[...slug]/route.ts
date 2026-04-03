/* THIS FILE WAS GENERATED AUTOMATICALLY BY PAYLOAD. */
/* DO NOT MODIFY IT BECAUSE IT COULD BE REWRITTEN AT ANY TIME. */
import config from '@payload-config';
import { REST_DELETE, REST_GET, REST_OPTIONS, REST_PATCH, REST_POST } from '@payloadcms/next/routes';

import { GET as healthGet } from '@/app/api/health/route';
import { GET as healthReadyGet } from '@/app/api/health/ready/route';
import { POST as cleanupRetentionPost } from '@/app/api/jobs/cleanup-retention/route';
import { POST as deleteFileArtifactsPost } from '@/app/api/jobs/delete-file-artifacts/route';
import { POST as ingestChunkPost } from '@/app/api/jobs/ingest-chunk/route';
import { POST as ingestEmbedPost } from '@/app/api/jobs/ingest-embed/route';
import { POST as ingestParsePost } from '@/app/api/jobs/ingest-parse/route';
import { POST as processInboundMessagePost } from '@/app/api/jobs/process-inbound-message/route';
import { POST as wahaWebhookPost } from '@/app/api/webhooks/waha/route';

type PayloadRouteContext = {
  params: Promise<{ slug?: string[] }>;
};

const payloadGet = REST_GET(config);
const payloadPost = REST_POST(config);
const payloadDelete = REST_DELETE(config);
const payloadPatch = REST_PATCH(config);
const payloadOptions = REST_OPTIONS(config);

function resolveCustomGetHandler(pathname: string) {
  if (pathname === '/api/health') {
    return healthGet;
  }

  if (pathname === '/api/health/ready') {
    return healthReadyGet;
  }

  return null;
}

function resolveCustomPostHandler(pathname: string) {
  switch (pathname) {
    case '/api/jobs/ingest-parse':
      return ingestParsePost;
    case '/api/jobs/ingest-chunk':
      return ingestChunkPost;
    case '/api/jobs/ingest-embed':
      return ingestEmbedPost;
    case '/api/jobs/delete-file-artifacts':
      return deleteFileArtifactsPost;
    case '/api/jobs/cleanup-retention':
      return cleanupRetentionPost;
    case '/api/jobs/process-inbound-message':
      return processInboundMessagePost;
    case '/api/webhooks/waha':
      return wahaWebhookPost;
    default:
      return null;
  }
}

export async function GET(req: Request, context: PayloadRouteContext) {
  const handler = resolveCustomGetHandler(new URL(req.url).pathname);
  if (handler) {
    return handler();
  }

  return payloadGet(req, context);
}

export async function POST(req: Request, context: PayloadRouteContext) {
  const handler = resolveCustomPostHandler(new URL(req.url).pathname);
  if (handler) {
    return handler();
  }

  return payloadPost(req, context);
}

export async function DELETE(req: Request, context: PayloadRouteContext) {
  return payloadDelete(req, context);
}

export async function PATCH(req: Request, context: PayloadRouteContext) {
  return payloadPatch(req, context);
}

export async function OPTIONS(req: Request, context: PayloadRouteContext) {
  return payloadOptions(req, context);
}
