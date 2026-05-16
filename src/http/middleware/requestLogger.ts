import type { Request, Response, NextFunction } from 'express';
import type { Logger } from '../../logger/logger.js';

/**
 * Logs every request/response pair with method, path, statusCode, durationMs,
 * and correlationId. traceId/spanId are injected automatically by the pino
 * mixin in core's createLogger when an OTel span is active. Attach after the
 * correlationId middleware.
 */
export function requestLogger(logger: Logger) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const start = Date.now();

    res.on('finish', () => {
      const log = logger.child({ correlationId: req.correlationId });
      log.info({
        method:     req.method,
        path:       req.path,
        statusCode: res.statusCode,
        durationMs: Date.now() - start,
      }, 'request completed');
    });

    next();
  };
}
