import type { Payload, Where } from 'payload';
import type { Config, User } from '@/payload-types';

type CollectionSlug = keyof Config['collections'];

interface TenantContextOptions {
  payload: Payload;
  user: User;
  collection: CollectionSlug;
  tenantField?: string;
  where?: Where;
}

export async function withTenantContext<T = unknown>(
  options: TenantContextOptions
): Promise<{ docs: T[] }> {
  const { payload, user, collection, tenantField = 'tenant', where } = options;

  const tenantRef = user.tenants?.[0]?.tenant;
  const tenantId = typeof tenantRef === 'number' ? tenantRef : tenantRef?.id;

  if (!tenantId) {
    throw new Error('User does not have an associated workspace');
  }

  const tenantConstraint: Where =
    collection === 'workspaces'
      ? {
          id: {
            equals: tenantId,
          },
        }
      : {
          [tenantField]: {
            equals: tenantId,
          },
        };

  const tenantWhere: Where = where
    ? {
        and: [where, tenantConstraint],
      }
    : tenantConstraint;

  const result = await payload.find({
    collection,
    where: tenantWhere,
    overrideAccess: false,
    user,
  });

  return result as unknown as { docs: T[] };
}
