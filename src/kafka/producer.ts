/**
 * Kafka producer factory — wraps KafkaJS with Brainwave conventions.
 *
 * Usage (in each service's src/index.ts or app.ts):
 *
 *   import { createEventProducer, emitEvent, KAFKA_TOPICS } from '@brainwave-project/core';
 *
 *   const producer = await createEventProducer({
 *     brokers: [process.env.KAFKA_BROKERS ?? 'kafka:9092'],
 *     clientId: 'know-hub',
 *   });
 *
 *   // In a handler (fire-and-forget):
 *   emitEvent(producer, KAFKA_TOPICS.DOCUMENT, event, logger);
 *
 * emitEvent is intentionally NOT awaited in business handlers —
 * audit failures must never block the business response.
 */

import type { DomainEvent, KafkaTopic } from './events.js';

export interface ProducerConfig {
  brokers:  string[];
  clientId: string;
}

export interface EventProducer {
  send(topic: KafkaTopic, event: DomainEvent): Promise<void>;
  disconnect(): Promise<void>;
}

/**
 * Creates and connects a KafkaJS producer.
 * Requires kafkajs to be installed in the consuming service.
 * Gracefully no-ops if kafkajs is not installed (same pattern as OTel).
 */
export async function createEventProducer(config: ProducerConfig): Promise<EventProducer> {
  try {
    // Dynamic import — core is ESM so `require` is undefined here. The dynamic
    // form lets consuming services opt out of Kafka simply by not installing
    // kafkajs (the import throws ERR_MODULE_NOT_FOUND and we fall through to
    // the no-op producer below).
    const { Kafka } = await import('kafkajs');

    const kafka = new Kafka({
      clientId: config.clientId,
      brokers:  config.brokers,
      retry: {
        initialRetryTime: 300,
        retries:          5,
      },
    });

    const producer = kafka.producer({
      allowAutoTopicCreation: false,   // topics must be pre-created by kafka-init
      transactionTimeout:     30000,
    });

    await producer.connect();
    console.info(`[kafka] Producer connected — clientId=${config.clientId}`);

    return {
      async send(topic: KafkaTopic, event: DomainEvent): Promise<void> {
        await producer.send({
          topic,
          messages: [{
            key:   event.eventId,
            value: JSON.stringify(event),
            headers: {
              'event-type':     event.action,
              'service':        event.service,
              'correlation-id': event.correlationId ?? '',
            },
          }],
        });
      },
      disconnect: () => producer.disconnect(),
    };
  } catch {
    console.warn('[kafka] kafkajs not installed — event emission disabled');
    // No-op producer — service boots cleanly without kafkajs
    return {
      send:       async () => {},
      disconnect: async () => {},
    };
  }
}

/**
 * Fire-and-forget event emitter.
 * Swallows all errors so a Kafka outage never propagates to the caller.
 */
export function emitEvent(
  producer: EventProducer,
  topic:    KafkaTopic,
  event:    DomainEvent,
  logger?:  { error: (obj: object, msg: string) => void },
): void {
  producer.send(topic, event).catch((err: unknown) => {
    if (logger) {
      logger.error({ err, eventId: event.eventId, action: event.action }, 'Failed to emit audit event');
    } else {
      console.error(`[kafka] emit failed eventId=${event.eventId}`, err);
    }
  });
}
