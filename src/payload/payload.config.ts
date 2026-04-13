import { buildConfig } from 'payload';
import { postgresAdapter } from '@payloadcms/db-postgres';
import { s3Storage } from '@payloadcms/storage-s3';
import { multiTenantPlugin } from '@payloadcms/plugin-multi-tenant';
import path from 'path';
import { fileURLToPath } from 'url';

import type { User } from '../payload-types.ts';
import { env } from '../core/env.ts';
import {
  Agents,
  Conversations,
  IngestionJobs,
  KnowledgeChunks,
  KnowledgeFiles,
  Messages,
  MessageTraces,
  Users,
  WhatsappSessions,
  Workspaces,
} from './collections/index.ts';

const filename = fileURLToPath(import.meta.url);
const dirname = path.dirname(filename);

export default buildConfig({
  admin: {
    user: 'users',
    importMap: {
      baseDir: path.resolve(dirname, '../app/(payload)'),
    },
  },
  collections: [
    Users,
    Workspaces,
    Agents,
    WhatsappSessions,
    KnowledgeFiles,
    KnowledgeChunks,
    Conversations,
    Messages,
    MessageTraces,
    IngestionJobs,
  ],
  secret: env.PAYLOAD_SECRET,
  typescript: {
    outputFile: path.resolve(dirname, '../payload-types.ts'),
  },
  db: postgresAdapter({
    migrationDir: path.resolve(dirname, 'migrations'),
    push: env.NODE_ENV !== 'production',
    pool: {
      connectionString: env.DATABASE_URL,
    },
  }),
  plugins: [
    s3Storage({
      collections: {
        knowledge_files: {
          prefix: 'knowledge',
        },
      },
      bucket: env.R2_BUCKET,
      config: {
        endpoint: env.R2_ENDPOINT,
        region: env.R2_REGION,
        credentials: {
          accessKeyId: env.R2_ACCESS_KEY_ID,
          secretAccessKey: env.R2_SECRET_ACCESS_KEY,
        },
      },
    }),
    multiTenantPlugin({
      tenantsSlug: 'workspaces',
      tenantsArrayField: {
        includeDefaultField: false,
      },
      userHasAccessToAllTenants: (user) => (user as User).role === 'admin',
      collections: {
        users: {},
      },
    }),
  ],
  serverURL: env.APP_URL,
});
