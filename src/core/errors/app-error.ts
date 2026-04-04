import { ErrorCode, type ErrorMetadata, type ErrorSeverity } from './error-codes.ts';

export class AppError extends Error {
  public readonly code: ErrorCode;
  public readonly severity: ErrorSeverity;
  public readonly statusCode: number;
  public readonly metadata: Partial<ErrorMetadata>;

  constructor(
    message: string,
    code: ErrorCode = ErrorCode.INTERNAL_ERROR,
    statusCode: number = 500,
    severity: ErrorSeverity = 'medium',
    metadata?: Partial<ErrorMetadata>
  ) {
    super(message);
    this.name = 'AppError';
    this.code = code;
    this.statusCode = statusCode;
    this.severity = severity;
    this.metadata = metadata || {};

    Error.captureStackTrace(this, this.constructor);
  }

  public toJSON(): Record<string, unknown> {
    return {
      name: this.name,
      message: this.message,
      code: this.code,
      severity: this.severity,
      statusCode: this.statusCode,
      metadata: this.metadata,
      stack: this.stack,
    };
  }

  public toPublicJSON(): Record<string, unknown> {
    return {
      error: {
        message: this.message,
        code: this.code,
      },
    };
  }

  public static fromError(error: unknown, code?: ErrorCode): AppError {
    if (error instanceof AppError) {
      return error;
    }

    const message = error instanceof Error ? error.message : 'An unknown error occurred';
    return new AppError(message, code || ErrorCode.INTERNAL_ERROR);
  }
}
