import * as grpc from '@grpc/grpc-js';

export interface MetadataOptions {
  correlationId?: string;
  token?: string;
}

/**
 * Builds gRPC Metadata for internal service-to-service calls.
 * Propagates correlationId so the full call chain is traceable.
 */
export function buildMetadata(options: MetadataOptions): grpc.Metadata {
  const metadata = new grpc.Metadata();

  if (options.correlationId) {
    metadata.set('x-correlation-id', options.correlationId);
  }

  if (options.token) {
    metadata.set('authorization', `Bearer ${options.token}`);
  }

  return metadata;
}
