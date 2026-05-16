import pino from 'pino';
import { trace } from '@opentelemetry/api';

export interface LoggerOptions {
  serviceName: string;
  level?: string;
  correlationId?: string;
}

/**
 * Pino mixin — runs on every log call. Reads the active OTel span and
 * injects traceId + spanId into the log line so EVERY log (not just
 * request-completed) can be correlated to a Tempo trace.
 *
 * When no SDK is running or no span is active (startup, background jobs)
 * the function returns {} and the fields are simply omitted.
 */
function otelMixin(): Record<string, string> {
  const span = trace.getActiveSpan();
  if (!span) return {};
  const ctx = span.spanContext();
  return { traceId: ctx.traceId, spanId: ctx.spanId };
}

/**
 * Creates a Pino logger bound to a service name.
 * Every log line includes: time (ISO), level, service, pid, and — when
 * an OTel span is active — traceId + spanId for Loki → Tempo correlation.
 * Pass correlationId via childLogger() to scope to a single request.
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
    mixin: otelMixin,
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
