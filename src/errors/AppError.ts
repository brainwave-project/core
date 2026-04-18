import { ErrorCode } from './codes.js';

export class AppError extends Error {
  public readonly code: string;
  public readonly statusCode: number;
  public readonly meta?: Record<string, unknown>;

  constructor(
    message: string,
    code: string,
    statusCode: number,
    meta?: Record<string, unknown>,
  ) {
    super(message);
    this.name = 'AppError';
    this.code = code;
    this.statusCode = statusCode;
    this.meta = meta;
    Error.captureStackTrace(this, this.constructor);
  }

  toJSON(): Record<string, unknown> {
    return {
      error: {
        code: this.code,
        message: this.message,
        ...(this.meta ? { meta: this.meta } : {}),
      },
    };
  }

  // ---- Named constructors (most common cases) --------------------------------

  static notFound(resource: string, id?: string): AppError {
    return new AppError(
      id ? `${resource} '${id}' not found` : `${resource} not found`,
      ErrorCode.NOT_FOUND,
      404,
    );
  }

  static unauthorized(message = 'Unauthorized'): AppError {
    return new AppError(message, ErrorCode.UNAUTHORIZED, 401);
  }

  static forbidden(message = 'Forbidden'): AppError {
    return new AppError(message, ErrorCode.FORBIDDEN, 403);
  }

  static conflict(message: string, meta?: Record<string, unknown>): AppError {
    return new AppError(message, ErrorCode.CONFLICT, 409, meta);
  }

  static validationError(message: string, meta?: Record<string, unknown>): AppError {
    return new AppError(message, ErrorCode.VALIDATION_ERROR, 422, meta);
  }

  static invalidStateTransition(from: string, to: string): AppError {
    return new AppError(
      `Invalid state transition: ${from} → ${to}`,
      ErrorCode.INVALID_STATE_TRANSITION,
      409,
      { from, to },
    );
  }

  static idempotencyConflict(key: string): AppError {
    return new AppError(
      `Request with idempotency key '${key}' is already in progress`,
      ErrorCode.IDEMPOTENCY_CONFLICT,
      409,
      { key },
    );
  }

  static internal(message = 'An unexpected error occurred'): AppError {
    return new AppError(message, ErrorCode.INTERNAL_ERROR, 500);
  }
}
