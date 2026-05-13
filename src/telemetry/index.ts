/**
 * OpenTelemetry SDK initialiser — call this BEFORE any other imports.
 *
 * Reads from environment:
 *   OTEL_EXPORTER_OTLP_ENDPOINT  default: http://otel-collector:4317
 *   SERVICE_NAME                  required (already set in every service .env)
 *   OTEL_SDK_DISABLED             set to "true" to skip init (e.g. unit tests)
 *
 * Usage (each service's src/index.ts — must be the very first import):
 *
 *   import { initTelemetry } from '@brainwave-project/core';
 *   initTelemetry();          // ← before any other code
 *
 *   import { startServer } from './app.js';
 *   startServer();
 *
 * Packages required in each service's package.json (add to dependencies):
 *   @opentelemetry/sdk-node
 *   @opentelemetry/auto-instrumentations-node
 *   @opentelemetry/exporter-trace-otlp-grpc
 *   @opentelemetry/resources
 *   @opentelemetry/semantic-conventions
 *
 * When those packages are not installed the function is a graceful no-op so
 * that services without OTel packages still boot cleanly.
 */

export function initTelemetry(): void {
  if (process.env['OTEL_SDK_DISABLED'] === 'true') return;

  const serviceName =
    process.env['OTEL_SERVICE_NAME'] ??
    process.env['SERVICE_NAME'] ??
    'unknown-service';

  const endpoint =
    process.env['OTEL_EXPORTER_OTLP_ENDPOINT'] ?? 'http://otel-collector:4317';

  try {
    // Dynamic require — OTel packages are optional. Services that want tracing
    // must add them explicitly; others still boot without them.
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { NodeSDK } = require('@opentelemetry/sdk-node');
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { getNodeAutoInstrumentations } = require('@opentelemetry/auto-instrumentations-node');
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { OTLPTraceExporter } = require('@opentelemetry/exporter-trace-otlp-grpc');
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { Resource } = require('@opentelemetry/resources');
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { SEMRESATTRS_SERVICE_NAME } = require('@opentelemetry/semantic-conventions');

    const sdk = new NodeSDK({
      resource: new Resource({
        [SEMRESATTRS_SERVICE_NAME]: serviceName,
      }),
      traceExporter: new OTLPTraceExporter({ url: endpoint }),
      instrumentations: [
        getNodeAutoInstrumentations({
          // Disable noisy instrumentations in dev
          '@opentelemetry/instrumentation-fs': { enabled: false },
          '@opentelemetry/instrumentation-dns': { enabled: false },
          '@opentelemetry/instrumentation-net': { enabled: false },
        }),
      ],
    });

    sdk.start();

    // Graceful shutdown — flush spans before process exits
    process.on('SIGTERM', () => sdk.shutdown().catch(console.error));
    process.on('SIGINT',  () => sdk.shutdown().catch(console.error));

    console.info(`[telemetry] OTel SDK started — service=${serviceName} endpoint=${endpoint}`);
  } catch {
    // OTel packages not installed — skip silently
    console.info('[telemetry] OTel packages not found — tracing disabled');
  }
}
