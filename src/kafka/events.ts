/**
 * Domain event contract — shared across all services and audit-hub.
 *
 * Naming convention:
 *   Topics:  brainwave.<domain>.events
 *   Actions: <ENTITY>_<VERB>  (SCREAMING_SNAKE_CASE)
 *
 * Every service MUST emit these events after a successful material action.
 * Events are fire-and-forget — a Kafka publish failure NEVER blocks the
 * business response. If Kafka is down, log the error and continue.
 */

// ---------------------------------------------------------------------------
// Kafka topic registry
// ---------------------------------------------------------------------------
export const KAFKA_TOPICS = {
  AUTH:     'brainwave.auth.events',
  USER:     'brainwave.user.events',
  DOCUMENT: 'brainwave.document.events',
} as const;

export type KafkaTopic = typeof KAFKA_TOPICS[keyof typeof KAFKA_TOPICS];

// ---------------------------------------------------------------------------
// Standard consumer group names
// ---------------------------------------------------------------------------
export const CONSUMER_GROUPS = {
  AUDIT_HUB:       'brainwave.audit-hub',
  SEMANTIC_WORKER: 'brainwave.know-hub.semantic-worker',
  // Phase 3: agent-hub's ingestion crew replaces the in-process semantic worker
  // (ADR-AGT-05). A NEW group so the cutover is a clean consumer-group switch.
  INGESTION_CREW:  'brainwave.agent-hub.ingestion-crew',
} as const;

// ---------------------------------------------------------------------------
// Audit actions — every material event has an explicit name
// ---------------------------------------------------------------------------
export const AuditAction = {
  // Auth
  LOGIN_SUCCESS:    'LOGIN_SUCCESS',
  LOGIN_FAILURE:    'LOGIN_FAILURE',
  LOGOUT:           'LOGOUT',
  TOKEN_REFRESHED:  'TOKEN_REFRESHED',

  // User lifecycle
  USER_CREATED:         'USER_CREATED',
  USER_STATUS_CHANGED:  'USER_STATUS_CHANGED',
  USER_ROLES_ASSIGNED:  'USER_ROLES_ASSIGNED',
  USER_DELETED:         'USER_DELETED',

  // Document lifecycle
  DOCUMENT_UPLOADED:    'DOCUMENT_UPLOADED',
  DOCUMENT_DOWNLOADED:  'DOCUMENT_DOWNLOADED',
  DOCUMENT_ARCHIVED:    'DOCUMENT_ARCHIVED',
  DOCUMENT_DELETED:     'DOCUMENT_DELETED',

  // Phase 3 — agentic ingestion crew (agent-hub)
  DOCUMENT_CLASSIFIED:  'DOCUMENT_CLASSIFIED',  // Classifier decided doc_type/topic
  DOCUMENT_INDEXED:     'DOCUMENT_INDEXED',     // crew finished indexing

  // Notes
  NOTE_CREATED: 'NOTE_CREATED',
} as const;

export type AuditActionType = typeof AuditAction[keyof typeof AuditAction];

// ---------------------------------------------------------------------------
// Domain event envelope
// ---------------------------------------------------------------------------
export interface DomainEvent {
  /** Unique event ID — used as Kafka message key and idempotency key in audit-hub */
  eventId: string;

  /** ISO 8601 timestamp when the action occurred (server time) */
  occurredAt: string;

  /** Which service emitted the event */
  service: 'auth-hub' | 'user-hub' | 'know-hub' | 'agent-hub';

  /** The action that was performed */
  action: AuditActionType;

  /** Who performed the action */
  actor: {
    userId:  string;   // Keycloak sub
    email?:  string;
    roles?:  string[];
  };

  /** What resource was acted upon (optional for session events) */
  resource?: {
    type:  string;   // 'Document' | 'User' | 'Note'
    id:    string;
    name?: string;
  };

  /** Did the action succeed or fail? */
  outcome: 'SUCCESS' | 'FAILURE';

  /** Correlation ID from Kong/request logger — links event to traces and logs */
  correlationId?: string;

  /** Arbitrary per-event context: old/new state, size, counts, etc. */
  metadata?: Record<string, unknown>;
}
