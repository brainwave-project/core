import * as grpc from '@grpc/grpc-js';
import * as protoLoader from '@grpc/proto-loader';

export interface GrpcClientOptions {
  /** Hostname of the target service (e.g. "auth-hub" on Docker network) */
  host: string;
  /** gRPC port */
  port: number;
  /** Absolute path to the .proto file */
  protoPath: string;
  /** Top-level package name declared in the proto file */
  packageName: string;
  /** Service name declared in the proto file */
  serviceName: string;
}

/**
 * Creates a typed, insecure gRPC client.
 * Services use this to call AuthHub's ValidateToken RPC internally.
 *
 * Usage:
 *   const client = createGrpcClient<AuthHubClient>({
 *     host: env.AUTH_HUB_GRPC_HOST,
 *     port: env.AUTH_HUB_GRPC_PORT,
 *     protoPath: ...,
 *     packageName: 'authhub',
 *     serviceName: 'TokenValidation',
 *   });
 */
export function createGrpcClient<T>(options: GrpcClientOptions): T {
  const { host, port, protoPath, packageName, serviceName } = options;

  const packageDef = protoLoader.loadSync(protoPath, {
    keepCase: true,
    longs: String,
    enums: String,
    defaults: true,
    oneofs: true,
  });

  const proto = grpc.loadPackageDefinition(packageDef) as unknown as Record<
    string,
    Record<string, new (addr: string, creds: grpc.ChannelCredentials) => T>
  >;

  const ServiceClass = proto[packageName]?.[serviceName];

  if (!ServiceClass) {
    throw new Error(
      `gRPC service '${packageName}.${serviceName}' not found in proto at ${protoPath}`,
    );
  }

  return new ServiceClass(
    `${host}:${port}`,
    grpc.credentials.createInsecure(), // TLS handled at network layer (mTLS via service mesh in prod)
  );
}
