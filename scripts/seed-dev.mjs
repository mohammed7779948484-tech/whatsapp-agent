#!/usr/bin/env node

import { getPayload } from 'payload';

import config from '../src/payload/payload.config.ts';

const DEV_WORKSPACE_SLUG = 'dev-workspace';
const DEV_OWNER_EMAIL = 'owner@dev.local';
const DEV_OWNER_PASSWORD = 'owner-dev-password-123';

function logStep(message) {
  console.log(`[seed:dev] ${message}`);
}

async function createKnowledgeFileMetadata(payload, workspaceId) {
  const now = new Date().toISOString();
  const database = payload.db;

  await database.execute({
    drizzle: database.drizzle,
    raw: `
      INSERT INTO knowledge_files (
        workspace_id,
        mime_type,
        parse_status,
        ingestion_status,
        uploaded_at,
        prefix,
        updated_at,
        created_at,
        url,
        filename,
        filesize
      ) VALUES (
        ${workspaceId},
        'application/pdf',
        'pending',
        'pending',
        '${now}',
        'knowledge',
        '${now}',
        '${now}',
        '/knowledge/sample-product-catalog.pdf',
        'sample-product-catalog.pdf',
        0
      );
    `,
  });
}

async function main() {
  const payload = await getPayload({ config });

  logStep('Checking for existing dev workspace');

  const existingWorkspaces = await payload.find({
    collection: 'workspaces',
    where: {
      slug: {
        equals: DEV_WORKSPACE_SLUG,
      },
    },
    limit: 1,
    depth: 0,
    overrideAccess: true,
  });

  if (existingWorkspaces.docs.length > 0) {
    logStep('Seed data already exists, skipping');
    return;
  }

  logStep('Finding admin user');

  const adminUsers = await payload.find({
    collection: 'users',
    where: {
      role: {
        equals: 'admin',
      },
    },
    limit: 1,
    depth: 0,
    overrideAccess: true,
  });

  const adminUser = adminUsers.docs[0];

  if (!adminUser) {
    throw new Error('Admin user not found. Run seed:admin first.');
  }

  logStep(`Admin user found: ${adminUser.email}`);

  logStep('Creating dev workspace');

  let workspace = await payload.create({
    collection: 'workspaces',
    data: {
      name: 'Dev Workspace',
      slug: DEV_WORKSPACE_SLUG,
      status: 'active',
    },
    overrideAccess: true,
  });

  logStep('Creating owner user');

  const owner = await payload.create({
    collection: 'users',
    data: {
      email: DEV_OWNER_EMAIL,
      password: DEV_OWNER_PASSWORD,
      role: 'owner',
      tenant: workspace.id,
      tenants: [
        {
          tenant: workspace.id,
        },
      ],
    },
    overrideAccess: true,
  });

  logStep('Assigning owner to workspace');

  workspace = await payload.update({
    collection: 'workspaces',
    id: workspace.id,
    data: {
      owner: owner.id,
    },
    overrideAccess: true,
  });

  logStep('Creating agent');

  await payload.create({
    collection: 'agents',
    data: {
      workspace: workspace.id,
      display_name: 'Dev Store Assistant',
      response_style: 'Friendly and helpful',
      system_prompt: 'You are a helpful store assistant.',
      is_enabled: true,
    },
    overrideAccess: true,
  });

  logStep('Creating WhatsApp session placeholder');

  await payload.create({
    collection: 'whatsapp_sessions',
    data: {
      workspace: workspace.id,
      session_name: `workspace_${workspace.id}`,
      provider_status: 'disconnected',
    },
    overrideAccess: true,
  });

  logStep('Creating sample knowledge file metadata');
  await createKnowledgeFileMetadata(payload, workspace.id);

  logStep('Development seed completed successfully');
}

main()
  .then(() => {
    process.exit(0);
  })
  .catch((error) => {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`[seed:dev] Failed: ${message}`);
    process.exit(1);
  });
