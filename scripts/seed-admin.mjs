#!/usr/bin/env node

import { getPayload } from 'payload';

import config from '../src/payload/payload.config.ts';

const adminEmail = process.env.ADMIN_EMAIL;
const adminPassword = process.env.ADMIN_PASSWORD;
const bootstrapWorkspaceName = process.env.ADMIN_WORKSPACE_NAME || 'Internal Admin Workspace';
const bootstrapWorkspaceSlug = process.env.ADMIN_WORKSPACE_SLUG || 'internal-admin-workspace';

if (!adminEmail || !adminPassword) {
  console.error('Missing ADMIN_EMAIL or ADMIN_PASSWORD in environment variables.');
  process.exit(1);
}

if (adminPassword.length < 8) {
  console.error('ADMIN_PASSWORD must be at least 8 characters long.');
  process.exit(1);
}

async function ensureWorkspace(payload) {
  const existingWorkspace = await payload.find({
    collection: 'workspaces',
    where: {
      slug: {
        equals: bootstrapWorkspaceSlug,
      },
    },
    limit: 1,
    overrideAccess: true,
  });

  if (existingWorkspace.docs[0]) {
    return existingWorkspace.docs[0];
  }

  return payload.create({
    collection: 'workspaces',
    data: {
      name: bootstrapWorkspaceName,
      slug: bootstrapWorkspaceSlug,
      status: 'active',
    },
    overrideAccess: true,
  });
}

async function main() {
  const payload = await getPayload({ config });

  try {
    const existingUser = await payload.find({
      collection: 'users',
      where: {
        email: {
          equals: adminEmail,
        },
      },
      limit: 1,
      overrideAccess: true,
    });

    if (existingUser.docs[0]) {
      console.log(`Admin user already exists: ${adminEmail}`);
      return;
    }

    const workspace = await ensureWorkspace(payload);

    await payload.create({
      collection: 'users',
      data: {
        email: adminEmail,
        password: adminPassword,
        role: 'admin',
        tenant: workspace.id,
        tenants: [{ tenant: workspace.id }],
      },
      overrideAccess: true,
    });

    console.log(`Admin user ready: ${adminEmail}`);
    console.log(`Assigned workspace: ${workspace.name} (${workspace.id})`);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error(`Failed to seed admin user: ${message}`);
    process.exitCode = 1;
  }
}

main()
  .then(() => {
    process.exit(0);
  })
  .catch((error) => {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`Failed to seed admin user: ${message}`);
    process.exit(1);
  });
