type LogLevel = 'debug' | 'info' | 'warn' | 'error';
type LogMetadata = Record<string, unknown>;

interface LogEntry {
  level: LogLevel;
  message: string;
  timestamp: string;
  metadata?: LogMetadata;
  error?: {
    name: string;
    message: string;
    stack?: string;
  };
}

class Logger {
  private readonly context: string;

  constructor(context: string) {
    this.context = context;
  }

  private formatTimestamp(): string {
    return new Date().toISOString();
  }

  private formatEntry(
    level: LogLevel,
    message: string,
    metadata?: LogMetadata,
    error?: Error
  ): LogEntry {
    const entry: LogEntry = {
      level,
      message,
      timestamp: this.formatTimestamp(),
    };

    if (metadata) {
      entry.metadata = { ...metadata, context: this.context };
    } else {
      entry.metadata = { context: this.context };
    }

    if (error) {
      entry.error = {
        name: error.name,
        message: error.message,
        stack: error.stack,
      };
    }

    return entry;
  }

  private output(entry: LogEntry): void {
    const output = JSON.stringify(entry);
    switch (entry.level) {
      case 'error':
        console.error(output);
        break;
      case 'warn':
        console.warn(output);
        break;
      case 'info':
      case 'debug':
        console.log(output);
        break;
    }
  }

  public debug(message: string, metadata?: LogMetadata): void {
    const entry = this.formatEntry('debug', message, metadata);
    this.output(entry);
  }

  public info(message: string, metadata?: LogMetadata): void {
    const entry = this.formatEntry('info', message, metadata);
    this.output(entry);
  }

  public warn(message: string, metadata?: LogMetadata): void {
    const entry = this.formatEntry('warn', message, metadata);
    this.output(entry);
  }

  public error(message: string, metadata?: LogMetadata, error?: Error): void {
    const entry = this.formatEntry('error', message, metadata, error);
    this.output(entry);
  }
}

export function createLogger(context: string): Logger {
  return new Logger(context);
}

export const logger = new Logger('app');