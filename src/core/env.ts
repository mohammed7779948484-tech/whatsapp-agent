const MIN_SECRET_LENGTH = 32;
const DEFAULT_R2_REGION = 'auto';
const DEFAULT_RETENTION_DAYS = 30;
const DEFAULT_MAX_UPLOAD_MB = 5;

type RequiredEnvVar =
  | 'APP_URL'
  | 'PAYLOAD_SECRET'
  | 'DATABASE_URL'
  | 'R2_ENDPOINT'
  | 'R2_ACCESS_KEY_ID'
  | 'R2_SECRET_ACCESS_KEY'
  | 'R2_BUCKET';

const VALID_NODE_ENVS = ['development', 'production', 'test'] as const;
type NodeEnv = (typeof VALID_NODE_ENVS)[number];

function getRequiredVariable(varName: RequiredEnvVar): string {
  const value = process.env[varName];
  if (!value) {
    throw new Error(`Missing required environment variable: ${varName}`);
  }

  return value;
}

function validateUrl(varName: string, value: string): string {
  try {
    new URL(value);
    return value;
  } catch {
    throw new Error(`${varName} must be a valid URL`);
  }
}

function validateDatabaseUrl(varName: string, value: string): string {
  const parsed = validateUrl(varName, value);
  const protocol = new URL(parsed).protocol;

  if (protocol !== 'postgres:' && protocol !== 'postgresql:') {
    throw new Error(`${varName} must be a valid PostgreSQL URL`);
  }

  return parsed;
}

function validateOptionalUrl(varName: string): string | undefined {
  const value = process.env[varName];
  if (!value) {
    return undefined;
  }

  return validateUrl(varName, value);
}

function validateBoolean(varName: string, defaultValue: boolean): boolean {
  const value = process.env[varName];
  if (!value) {
    return defaultValue;
  }

  if (value === 'true') {
    return true;
  }

  if (value === 'false') {
    return false;
  }

  throw new Error(`${varName} must be either "true" or "false"`);
}

function validatePositiveInteger(varName: string, defaultValue: number): number {
  const value = process.env[varName];
  if (!value) {
    return defaultValue;
  }

  const parsed = Number.parseInt(value, 10);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`${varName} must be a positive integer`);
  }

  return parsed;
}

function validateNodeEnv(): 'development' | 'production' {
  const value = process.env.NODE_ENV ?? 'development';
  if (!VALID_NODE_ENVS.includes(value as NodeEnv)) {
    throw new Error(`NODE_ENV must be one of: ${VALID_NODE_ENVS.join(', ')}. Got: ${value}`);
  }

  return value === 'test' ? 'development' : value;
}

function validateEnv() {
  const appUrl = validateUrl('APP_URL', getRequiredVariable('APP_URL'));
  const payloadSecret = getRequiredVariable('PAYLOAD_SECRET');
  const enableWahaSandbox = validateBoolean('ENABLE_WAHA_SANDBOX', false);
  const rawWahaAllowedIps = process.env.WAHA_ALLOWED_IPS ?? '';
  const parsedWahaAllowedIps = rawWahaAllowedIps
    .split(',')
    .map((ip) => ip.trim())
    .filter(Boolean);
  const rawWahaBaseUrl = process.env.WAHA_BASE_URL;
  const rawWahaAdminApiKey = process.env.WAHA_ADMIN_API_KEY;
  const rawWahaWebhookSecret = process.env.WAHA_WEBHOOK_HMAC_SECRET;

  if (payloadSecret.length < MIN_SECRET_LENGTH) {
    throw new Error(`PAYLOAD_SECRET must be at least ${MIN_SECRET_LENGTH} characters long`);
  }

  if (!enableWahaSandbox) {
    if (!rawWahaBaseUrl) {
      throw new Error('Missing required environment variable: WAHA_BASE_URL');
    }

    if (!rawWahaAdminApiKey) {
      throw new Error('Missing required environment variable: WAHA_ADMIN_API_KEY');
    }

    if (!rawWahaWebhookSecret) {
      throw new Error('Missing required environment variable: WAHA_WEBHOOK_HMAC_SECRET');
    }

    if (!rawWahaAllowedIps || parsedWahaAllowedIps.length === 0) {
      throw new Error(
        'WAHA_ALLOWED_IPS must contain at least one IP when ENABLE_WAHA_SANDBOX is false'
      );
    }
  }

  return {
    NODE_ENV: validateNodeEnv(),
    APP_URL: appUrl,
    PAYLOAD_SECRET: payloadSecret,
    DATABASE_URL: validateDatabaseUrl('DATABASE_URL', getRequiredVariable('DATABASE_URL')),
    NEON_DATABASE_URL: process.env.NEON_DATABASE_URL
      ? validateDatabaseUrl('NEON_DATABASE_URL', process.env.NEON_DATABASE_URL)
      : undefined,
    R2_ENDPOINT: validateUrl('R2_ENDPOINT', getRequiredVariable('R2_ENDPOINT')),
    R2_REGION: process.env.R2_REGION ?? DEFAULT_R2_REGION,
    R2_ACCESS_KEY_ID: getRequiredVariable('R2_ACCESS_KEY_ID'),
    R2_SECRET_ACCESS_KEY: getRequiredVariable('R2_SECRET_ACCESS_KEY'),
    R2_BUCKET: getRequiredVariable('R2_BUCKET'),
    R2_PUBLIC_BASE_URL: validateOptionalUrl('R2_PUBLIC_BASE_URL'),
    OPENAI_API_KEY: process.env.OPENAI_API_KEY,
    LLAMA_PARSE_API_KEY: process.env.LLAMA_PARSE_API_KEY,
    QSTASH_URL: validateOptionalUrl('QSTASH_URL'),
    QSTASH_TOKEN: process.env.QSTASH_TOKEN,
    QSTASH_CURRENT_SIGNING_KEY: process.env.QSTASH_CURRENT_SIGNING_KEY,
    QSTASH_NEXT_SIGNING_KEY: process.env.QSTASH_NEXT_SIGNING_KEY,
    WAHA_BASE_URL: enableWahaSandbox
      ? validateOptionalUrl('WAHA_BASE_URL') ?? ''
      : validateUrl('WAHA_BASE_URL', rawWahaBaseUrl as string),
    WAHA_ADMIN_API_KEY: enableWahaSandbox ? rawWahaAdminApiKey ?? '' : (rawWahaAdminApiKey as string),
    WAHA_WEBHOOK_HMAC_SECRET: enableWahaSandbox
      ? rawWahaWebhookSecret ?? ''
      : (rawWahaWebhookSecret as string),
    WAHA_ALLOWED_IPS: parsedWahaAllowedIps,
    ENABLE_WAHA_SANDBOX: enableWahaSandbox,
    RETENTION_DAYS: validatePositiveInteger('RETENTION_DAYS', DEFAULT_RETENTION_DAYS),
    MAX_UPLOAD_MB: validatePositiveInteger('MAX_UPLOAD_MB', DEFAULT_MAX_UPLOAD_MB),
  } as const;
}

export const env = validateEnv();
