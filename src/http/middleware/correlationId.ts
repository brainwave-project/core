import { randomUUID } from 'crypto';
import type { Request, Response, NextFunction } from 'express';

export const CORRELATION_ID_HEADER = 'x-correlation-id';

/**
 * Reads X-Correlation-Id from the incoming request (set by Kong at the edge).
 * Falls back to a new UUID if missing (direct calls bypassing Kong).
 * Attaches the ID to req.correlationId and echoes it on the response.
 */
export function correlationId() {
  return (req: Request, res: Response, next: NextFunction): void => {
    const id =
      (req.headers[CORRELATION_ID_HEADER] as string | undefined) ?? randomUUID();

    req.correlationId = id;
    res.setHeader(CORRELATION_ID_HEADER, id);
    next();
  };
}

// Augment Express Request so every handler has req.correlationId typed
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      correlationId: string;
    }
  }
}
