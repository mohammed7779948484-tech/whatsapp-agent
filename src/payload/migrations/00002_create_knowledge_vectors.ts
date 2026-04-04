import type { Payload } from 'payload';

interface MigrationArgs {
  payload: Payload;
}

interface PayloadDatabaseExecutor {
  drizzle: unknown;
  execute: (args: { drizzle: unknown; raw: string }) => Promise<unknown>;
}

const CREATE_KNOWLEDGE_VECTORS_STATEMENTS = [
  `
    CREATE TABLE IF NOT EXISTS knowledge_vectors (
      id SERIAL PRIMARY KEY,
      workspace_id INTEGER NOT NULL,
      file_id INTEGER NOT NULL,
      chunk_id INTEGER NOT NULL,
      embedding vector(1536) NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `,
  'CREATE INDEX IF NOT EXISTS idx_knowledge_vectors_workspace_id ON knowledge_vectors (workspace_id);',
  'CREATE INDEX IF NOT EXISTS idx_knowledge_vectors_file_id ON knowledge_vectors (file_id);',
  'CREATE INDEX IF NOT EXISTS idx_knowledge_vectors_chunk_id ON knowledge_vectors (chunk_id);',
  'CREATE INDEX IF NOT EXISTS idx_knowledge_vectors_embedding ON knowledge_vectors USING hnsw (embedding vector_cosine_ops);',
] as const;

const DROP_KNOWLEDGE_VECTORS_SQL = 'DROP TABLE IF EXISTS knowledge_vectors;';

export const up = async (args: MigrationArgs): Promise<void> => {
  const { payload } = args;
  const database = payload.db as unknown as PayloadDatabaseExecutor;

  for (const statement of CREATE_KNOWLEDGE_VECTORS_STATEMENTS) {
    await database.execute({ drizzle: database.drizzle, raw: statement });
  }
};

export const down = async (args: MigrationArgs): Promise<void> => {
  const { payload } = args;
  const database = payload.db as unknown as PayloadDatabaseExecutor;

  await database.execute({ drizzle: database.drizzle, raw: DROP_KNOWLEDGE_VECTORS_SQL });
};
