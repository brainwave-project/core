export {
  KAFKA_TOPICS,
  CONSUMER_GROUPS,
  AuditAction,
} from './events.js';

export type {
  KafkaTopic,
  AuditActionType,
  DomainEvent,
} from './events.js';

export {
  createEventProducer,
  emitEvent,
} from './producer.js';

export type {
  ProducerConfig,
  EventProducer,
} from './producer.js';
