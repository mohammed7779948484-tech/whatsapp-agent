const REQUIRED_ENV_VARS = [
  'APP_URL',
  'PAYLOAD_SECRET',
  'DATABASE_URL',
  'R2_ENDPOINT',
  'R2_ACCESS_KEY_ID',
  'R2_SECRET_ACCESS_KEY',
  'R2_BUCKET',
] as const;

const MIN_SECRET_LENGTH = 32;

const VALID_NODE_ENVS = ['development', 'production', 'test'] as const;
type NodeEnv = typeof VALID_NODE_ENVS[number];

function validateEnv(): {
  APP_URL: string;
  PAYLOAD_SECRET: string;
  DATABASE_URL: string;
  R2_ENDPOINT: string;
  R2_REGION: string;
  R2_ACCESS_KEY_ID: string;
  R2_SECRET_ACCESS_KEY: string;
  R2_BUCKET: string;
  R2_PUBLIC_BASE_URL?: string;
  NODE_ENV: 'development' | 'production';
} {
  const errors: string[] = [];

  for (const varName of REQUIRED_ENV_VARS) {
    if (!process.env[varName]) {
      errors.push(`Missing required environment variable: ${varName}`);
    }
  }

  if (errors.length > 0) {
    throw new Error(`Environment validation failed:\n${errors.join('\n')}`);
  }

  try {
    new URL(process.env.APP_URL!);
  } catch {
    throw new Error('APP_URL must be a valid URL');
  }

  try {
    new URL(process.env.DATABASE_URL!);
  } catch {
    throw new Error('DATABASE_URL must be a valid URL');
  }

  try {
    new URL(process.env.R2_ENDPOINT!);
  } catch {
    throw new Error('R2_ENDPOINT must be a valid URL');
  }

  if (process.env.PAYLOAD_SECRET!.length < MIN_SECRET_LENGTH) {
    throw new Error(`PAYLOAD_SECRET must be at least ${MIN_SECRET_LENGTH} characters long`);
  }

  const nodeEnv = process.env.NODE_ENV || 'development';
  if (!VALID_NODE_ENVS.includes(nodeEnv as NodeEnv)) {
    throw new Error(`NODE_ENV must be one of: ${VALID_NODE_ENVS.join(', ')}. Got: ${nodeEnv}`);
  }

  return {
    APP_URL: process.env.APP_URL!,
    PAYLOAD_SECRET: process.env.PAYLOAD_SECRET!,
    DATABASE_URL: process.env.DATABASE_URL!,
    R2_ENDPOINT: process.env.R2_ENDPOINT!,
    R2_REGION: process.env.R2_REGION || 'auto',
    R2_ACCESS_KEY_ID: process.env.R2_ACCESS_KEY_ID!,
    R2_SECRET_ACCESS_KEY: process.env.R2_SECRET_ACCESS_KEY!,
    R2_BUCKET: process.env.R2_BUCKET!,
    R2_PUBLIC_BASE_URL: process.env.R2_PUBLIC_BASE_URL,
    NODE_ENV: (nodeEnv === 'test' ? 'development' : nodeEnv) as 'development' | 'production',
  } as const;
}

export const env = validateEnv();