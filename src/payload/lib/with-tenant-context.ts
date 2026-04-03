import type { Payload, Where } from 'payload';
import type { Config, User } from '@/payload-types';

type CollectionSlug = keyof Config['collections'];

interface TenantContextOptions {
  payload: Payload;
  user: User;
  collection: CollectionSlug;
  where?: Where;
}

export async function withTenantContext<T = unknown>(
  options: TenantContextOptions
): Promise<{ docs: T[] }> {
  const { payload, user, collection, where } = options;

  const tenantRef = user.tenants?.[0]?.tenant;
  const tenantId = typeof tenantRef === 'number' ? tenantRef : tenantRef?.id;

  if (!tenantId) {
    throw new Error('User does not have an associated workspace');
  }

  const tenantWhere: Where = {
    and: [
      where || {},
      {
        tenants: {
          contains: tenantId,
        },
      },
    ],
  };

  const result = await payload.find({
    collection,
    where: tenantWhere,
    overrideAccess: false,
  });

  return result as unknown as { docs: T[] };
}
