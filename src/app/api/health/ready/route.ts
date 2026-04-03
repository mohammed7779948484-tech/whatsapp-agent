import { createLogger } from '@/core/logger';
import { getPayloadClient } from '@/payload/lib/get-payload';

const logger = createLogger('api/health/ready');
const DEPENDENCY_TIMEOUT_MS = 5000;

interface PayloadDatabaseExecutor {
  drizzle: unknown;
  execute: (args: { drizzle: unknown; raw: string }) => Promise<unknown>;
}

function createTimeoutPromise(timeoutMs: number) {
  return new Promise<never>((_, reject) => {
    setTimeout(() => {
      reject(new Error(`Database check timed out after ${timeoutMs}ms`));
    }, timeoutMs);
  });
}

async function checkDatabaseReadiness() {
  const payload = await getPayloadClient();
  const database = payload.db as unknown as PayloadDatabaseExecutor;

  await Promise.race([
    database.execute({ drizzle: database.drizzle, raw: 'SELECT 1;' }),
    createTimeoutPromise(DEPENDENCY_TIMEOUT_MS),
  ]);
}

export async function GET() {
  const timestamp = new Date().toISOString();

  try {
    await checkDatabaseReadiness();

    return Response.json({
      status: 'ready',
      timestamp,
      checks: {
        database: 'ok',
      },
    });
  } catch (error) {
    const reason = error instanceof Error ? error.message : 'Unknown database readiness error';

    logger.error('Database readiness check failed', { reason });

    return Response.json(
      {
        status: 'unhealthy',
        timestamp,
        checks: {
          database: 'unreachable',
        },
        reason,
      },
      { status: 503 },
    );
  }
}
