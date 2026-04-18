import type { Request, Response, NextFunction } from 'express';
import { AppError } from '../../errors/AppError.js';
import { ErrorCode } from '../../errors/codes.js';
import type { Logger } from '../../logger/logger.js';

/**
 * Express error handler middleware (must be registered last — 4-arg signature).
 *
 * AppError  → structured JSON response with the error's own statusCode
 * Any other → 500 INTERNAL_ERROR (stack logged, no leak to client)
 */
export function errorHandler(logger: Logger) {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  return (err: Error, req: Request, res: Response, _next: NextFunction): void => {
    const log = logger.child({ correlationId: req.correlationId });

    if (err instanceof AppError) {
      log.warn({ code: err.code, statusCode: err.statusCode, meta: err.meta }, err.message);
      res.status(err.statusCode).json(err.toJSON());
      return;
    }

    log.error({ err }, 'unhandled error');
    res.status(500).json({
      error: {
        code:    ErrorCode.INTERNAL_ERROR,
        message: 'An unexpected error occurred',
      },
    });
  };
}
