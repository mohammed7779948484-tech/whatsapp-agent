import type { Where } from 'payload';

export const DEFAULT_RETENTION_DAYS = 30;

/**
 * Returns the date-based filter that the future cleanup-retention job route
 * will use to find records older than the configured retention window.
 */
export function getRetentionCleanupFilter(
  retentionDays: number = DEFAULT_RETENTION_DAYS
): Where {
  const cutoffDate = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000);

  return {
    createdAt: {
      less_than: cutoffDate.toISOString(),
    },
  };
}
