import { buildConfig } from 'payload';
import { postgresAdapter } from '@payloadcms/db-postgres';
import { s3Storage } from '@payloadcms/storage-s3';
import { multiTenantPlugin } from '@payloadcms/plugin-multi-tenant';
import path from 'path';
import { fileURLToPath } from 'url';

import type { User } from '@/payload-types';

import { Users } from './collections/users.collection.ts';
import { Workspaces } from './collections/workspaces.collection.ts';
import { env } from '../core/env.ts';

const filename = fileURLToPath(import.meta.url);
const dirname = path.dirname(filename);

export default buildConfig({
  admin: {
    user: 'users',
    importMap: {
      baseDir: path.resolve(dirname),
    },
  },
  collections: [Users, Workspaces],
  secret: env.PAYLOAD_SECRET,
  typescript: {
    outputFile: path.resolve(dirname, '../payload-types.ts'),
  },
  db: postgresAdapter({
    migrationDir: path.resolve(dirname, 'migrations'),
    pool: {
      connectionString: env.DATABASE_URL,
    },
  }),
  plugins: [
    s3Storage({
      collections: {},
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
