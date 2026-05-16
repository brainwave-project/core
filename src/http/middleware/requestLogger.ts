import type { Request, Response, NextFunction } from 'express';
import { trace } from '@opentelemetry/api';
import type { Logger } from '../../logger/logger.js';

/**
 * Logs every request/response pair with method, path, statusCode, durationMs,
 * correlationId, and traceId. Attach after the correlationId middleware.
 *
 * traceId is captured at middleware entry time (when the OTel span is
 * guaranteed active) so it survives into the async res.finish callback.
 * When no OTel SDK is running, trace.getActiveSpan() returns undefined and
 * traceId is omitted from the log line entirely.
 */
export function requestLogger(logger: Logger) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const start = Date.now();

    // Capture now — active span is set at request entry, before any async hops.
    const traceId = trace.getActiveSpan()?.spanContext().traceId;

    res.on('finish', () => {
      const log = logger.child({ correlationId: req.correlationId });
      log.info({
        method:     req.method,
        path:       req.path,
        statusCode: res.statusCode,
        durationMs: Date.now() - start,
        ...(traceId ? { traceId } : {}),
      }, 'request completed');
    });

    next();
  };
}
