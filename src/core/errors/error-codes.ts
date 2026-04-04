export const ErrorCode = {
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  AUTHENTICATION_ERROR: 'AUTHENTICATION_ERROR',
  AUTHORIZATION_ERROR: 'AUTHORIZATION_ERROR',
  NOT_FOUND_ERROR: 'NOT_FOUND_ERROR',
  CONFLICT_ERROR: 'CONFLICT_ERROR',
  RATE_LIMIT_ERROR: 'RATE_LIMIT_ERROR',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  DATABASE_ERROR: 'DATABASE_ERROR',
  EXTERNAL_SERVICE_ERROR: 'EXTERNAL_SERVICE_ERROR',
  DUPLICATE_RESOURCE: 'DUPLICATE_RESOURCE',
  WORKSPACE_HAS_DEPENDENCIES: 'WORKSPACE_HAS_DEPENDENCIES',
  OWNER_ALREADY_ASSIGNED: 'OWNER_ALREADY_ASSIGNED',
} as const;

export type ErrorCode = (typeof ErrorCode)[keyof typeof ErrorCode];

export type ErrorSeverity = 'low' | 'medium' | 'high' | 'critical';

export interface ErrorMetadata {
  code: ErrorCode;
  severity: ErrorSeverity;
  timestamp: string;
  requestId?: string;
  userId?: string;
  workspaceId?: string;
  details?: Record<string, unknown>;
}
