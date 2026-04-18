import pino from 'pino';

export interface LoggerOptions {
  serviceName: string;
  level?: string;
  correlationId?: string;
}

/**
 * Creates a Pino logger bound to a service name.
 * All log lines include: time (ISO), level, service, pid.
 * Pass correlationId to get a child logger scoped to a single request.
 */
export function createLogger(options: LoggerOptions): pino.Logger {
  const { serviceName, level = process.env['LOG_LEVEL'] ?? 'info' } = options;

  return pino({
    level,
    base: {
      service: serviceName,
      pid: process.pid,
    },
    timestamp: pino.stdTimeFunctions.isoTime,
    formatters: {
      level(label) {
        return { level: label };
      },
    },
  });
}

/**
 * Creates a child logger scoped to a single request.
 * Inherits all base fields and adds correlationId.
 */
export function childLogger(
  logger: pino.Logger,
  correlationId: string,
): pino.Logger {
  return logger.child({ correlationId });
}

export type Logger = pino.Logger;
