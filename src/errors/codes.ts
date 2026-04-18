export const ErrorCode = {
  // Auth
  UNAUTHORIZED:             'UNAUTHORIZED',
  FORBIDDEN:                'FORBIDDEN',
  TOKEN_EXPIRED:            'TOKEN_EXPIRED',
  TOKEN_INVALID:            'TOKEN_INVALID',

  // Resource
  NOT_FOUND:                'NOT_FOUND',
  CONFLICT:                 'CONFLICT',
  DUPLICATE:                'DUPLICATE',

  // Validation
  VALIDATION_ERROR:         'VALIDATION_ERROR',

  // State machine
  INVALID_STATE_TRANSITION: 'INVALID_STATE_TRANSITION',

  // Idempotency
  IDEMPOTENCY_CONFLICT:     'IDEMPOTENCY_CONFLICT',

  // System
  INTERNAL_ERROR:           'INTERNAL_ERROR',
  SERVICE_UNAVAILABLE:      'SERVICE_UNAVAILABLE',
  DEPENDENCY_ERROR:         'DEPENDENCY_ERROR',
} as const;

export type ErrorCode = typeof ErrorCode[keyof typeof ErrorCode];
