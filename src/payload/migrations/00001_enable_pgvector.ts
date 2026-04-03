import type { Payload } from 'payload';

interface MigrationArgs {
  payload: Payload;
}

export const up = async (args: MigrationArgs): Promise<void> => {
  const { payload } = args;
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (payload.db as any).execute({ raw: 'CREATE EXTENSION IF NOT EXISTS vector;' });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    if (!errorMessage.includes('already installed')) {
      throw error;
    }
  }
};

export const down = async (args: MigrationArgs): Promise<void> => {
  const { payload } = args;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (payload.db as any).execute({ raw: 'DROP EXTENSION IF EXISTS vector;' });
};