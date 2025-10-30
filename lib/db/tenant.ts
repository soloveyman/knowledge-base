import { db } from './index'

// Temporary tenant DB accessor. For now returns the shared pool.
// businessId will be the stable tenant key. Later, resolve to per-tenant pools.
export function getTenantDb(businessId?: string) {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const _tenantKey = businessId || 'shared'
  return db
}


