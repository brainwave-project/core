# @brainwave-project/core

Stateless, domain-agnostic infrastructure library shared across all Brainwave microservices. Provides structured logging, HTTP middleware, error types, OpenTelemetry instrumentation, gRPC helpers, and the Kafka domain event contract so each service stays consistent without duplicating boilerplate.

## What's Inside

| Export | Description |
|---|---|
| `createLogger` / `childLogger` | Pino-based structured JSON logger with service name and ISO timestamps |
| `correlationId` | Express middleware — generates or propagates `X-Correlation-Id` on every request |
| `requestLogger` | Express middleware — logs method, path, status code, and duration on response finish |
| `errorHandler` | Express error middleware — maps `AppError` to structured JSON responses |
| `AppError` / `ErrorCode` | Typed domain errors with HTTP status and machine-readable codes |
| `initTelemetry` | OpenTelemetry SDK initialiser — auto-instruments HTTP, gRPC, DB, and Kafka |
| `createGrpcClient` / `buildMetadata` | gRPC channel factory and metadata builder for service-to-service calls |
| `KAFKA_TOPICS` | Topic registry: `brainwave.auth.events`, `brainwave.user.events`, `brainwave.document.events` |
| `AuditAction` | Enum of all platform actions (`LOGIN_SUCCESS`, `DOCUMENT_UPLOADED`, …) |
| `DomainEvent` | TypeScript interface for the shared Kafka event envelope |
| `createEventProducer` / `emitEvent` | Fire-and-forget Kafka producer — never blocks business logic on emit failure |

## Installation

This package is published to GitHub Packages. Add a `.npmrc` to your service:

```ini
@brainwave-project:registry=https://npm.pkg.github.com
//npm.pkg.github.com/:_authToken=${NPM_TOKEN}
```

Then install:

```bash
npm install @brainwave-project/core
```

`NPM_TOKEN` must be a GitHub personal access token (or Actions `GITHUB_TOKEN`) with `read:packages` scope.

## Usage

### Logger

```typescript
import { createLogger, childLogger } from '@brainwave-project/core';

const logger = createLogger({ serviceName: 'my-service', level: 'info' });

// Request-scoped child logger
const reqLogger = childLogger(logger, req.correlationId);
reqLogger.info({ userId }, 'user action performed');
```

### HTTP Middleware

```typescript
import { correlationId, requestLogger, errorHandler } from '@brainwave-project/core';

app.use(correlationId);           // must be first
app.use(requestLogger(logger));   // after correlationId
// ... routes ...
app.use(errorHandler(logger));    // must be last
```

### Kafka Events

```typescript
import { createEventProducer, emitEvent, KAFKA_TOPICS, AuditAction } from '@brainwave-project/core';

const producer = await createEventProducer({
  clientId: 'my-service',
  brokers: ['kafka:9092'],
});

await emitEvent(producer, KAFKA_TOPICS.AUTH, {
  eventId:       crypto.randomUUID(),
  occurredAt:    new Date().toISOString(),
  service:       'auth-hub',
  action:        AuditAction.LOGIN_SUCCESS,
  actor:         { userId: 'keycloak-sub', email: 'user@example.com' },
  outcome:       'SUCCESS',
  correlationId: req.correlationId,
});
```

### OpenTelemetry

```typescript
// src/index.ts — must be the VERY FIRST import
import { initTelemetry } from '@brainwave-project/core';
initTelemetry();

// All subsequent imports are automatically instrumented
import { startServer } from './app.js';
startServer();
```

Reads `OTEL_EXPORTER_OTLP_ENDPOINT` (default: `http://otel-collector:4317`) and `SERVICE_NAME` / `OTEL_SERVICE_NAME` from the environment. Set `OTEL_SDK_DISABLED=true` to skip init in unit tests. OTel packages (`@opentelemetry/sdk-node`, etc.) are optional peer dependencies — if not installed, `initTelemetry` is a graceful no-op.

## Development

```bash
npm install
npm run dev     # tsc --watch
npm run build   # compile to dist/
npm run lint    # eslint
```

## Release

Versioning is automated via Semantic Release on push to `main`. Use Conventional Commits:

```
feat: ...   → minor version bump
fix: ...    → patch version bump
feat!: ...  → major version bump
```

The compiled `dist/` is published to `npm.pkg.github.com` automatically by CI.

## Project Structure

```
core/
├─ src/
│  ├─ errors/         AppError + ErrorCode
│  ├─ logger/         createLogger, childLogger (pino)
│  ├─ http/
│  │  └─ middleware/  correlationId, requestLogger, errorHandler
│  ├─ telemetry/      initTelemetry (OTel SDK)
│  ├─ grpc/           createGrpcClient, buildMetadata
│  ├─ kafka/          events.ts (DomainEvent, AuditAction, KAFKA_TOPICS)
│  │                  producer.ts (createEventProducer, emitEvent)
│  └─ index.ts        public exports
├─ dist/              compiled output (published to GitHub Packages)
├─ package.json
└─ tsconfig.json
```

## License

MIT © Ahmad Awad
