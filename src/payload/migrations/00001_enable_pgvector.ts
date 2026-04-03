import type { Payload } from 'payload';

interface MigrationArgs {
  payload: Payload;
}

interface PayloadDatabaseExecutor {
  drizzle: unknown;
  execute: (args: { drizzle: unknown; raw: string }) => Promise<unknown>;
}

export const up = async (args: MigrationArgs): Promise<void> => {
  const { payload } = args;
  const database = payload.db as unknown as PayloadDatabaseExecutor;

  try {
    await database.execute({ drizzle: database.drizzle, raw: 'CREATE EXTENSION IF NOT EXISTS vector;' });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    if (!errorMessage.includes('already installed')) {
      throw error;
    }
  }
};

export const down = async (args: MigrationArgs): Promise<void> => {
  const { payload } = args;
  const database = payload.db as unknown as PayloadDatabaseExecutor;

  await database.execute({ drizzle: database.drizzle, raw: 'DROP EXTENSION IF EXISTS vector;' });
};
