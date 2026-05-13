// Errors
export { AppError } from './errors/AppError.js';
export { ErrorCode } from './errors/codes.js';
export type { ErrorCodeType } from './errors/index.js';

// Logger (Pino-based)
export { createLogger, childLogger } from './logger/logger.js';
export type { Logger, LoggerOptions } from './logger/logger.js';

// HTTP middleware
export { correlationId, CORRELATION_ID_HEADER } from './http/middleware/correlationId.js';
export { requestLogger } from './http/middleware/requestLogger.js';
export { errorHandler } from './http/middleware/errorHandler.js';

// Telemetry (OTel SDK init + graceful shutdown)
export { initTelemetry } from './telemetry/index.js';

// gRPC helpers
export { createGrpcClient } from './grpc/client.js';
export type { GrpcClientOptions } from './grpc/client.js';
export { buildMetadata } from './grpc/metadata.js';
export type { MetadataOptions } from './grpc/metadata.js';
