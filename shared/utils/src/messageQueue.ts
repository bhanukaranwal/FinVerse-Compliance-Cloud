import { Kafka, Producer, Consumer, KafkaMessage, logLevel } from 'kafkajs';
import { config } from '@finverse/shared-config';
import { createServiceLogger } from './logger';

export interface MessageHandler {
  (message: any, metadata: MessageMetadata): Promise<void>;
}

export interface MessageMetadata {
  topic: string;
  partition: number;
  offset: string;
  timestamp: string;
  headers?: Record<string, string>;
  key?: string;
}

export interface PublishOptions {
  key?: string;
  partition?: number;
  timestamp?: string;
  headers?: Record<string, string>;
}

export class MessageQueueService {
  private kafka: Kafka;
  private producer: Producer;
  private consumers: Map<string, Consumer> = new Map();
  private handlers: Map<string, MessageHandler> = new Map();
  private logger = createServiceLogger('message-queue');
  private isInitialized = false;

  constructor() {
    this.kafka = new Kafka({
      clientId: 'finverse-compliance-cloud',
      brokers: config.kafka.brokers,
      logLevel: logLevel.WARN,
      retry: {
        initialRetryTime: 100,
        retries: 8,
        maxRetryTime: 30000,
        factor: 2,
        multiplier: 2,
        restartOnFailure: async (e) => {
          this.logger.error('Kafka restart on failure:', e);
          return true;
        },
      },
      connectionTimeout: 3000,
      requestTimeout: 30000,
    });

    this.producer = this.kafka.producer({
      maxInFlightRequests: 1,
      idempotent: true,
      transactionTimeout: 30000,
      retry: {
        initialRetryTime: 100,
        retries: 5,
      },
    });
  }

  async initialize(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    try {
      this.logger.info('Initializing message queue service...');
      
      await this.producer.connect();
      this.logger.info('✅ Message queue producer connected');
      
      this.isInitialized = true;
    } catch (error) {
      this.logger.error('❌ Failed to initialize message queue:', error);
      throw new Error(`Message queue initialization failed: ${error.message}`);
    }
  }

  async publishMessage(
    topic: string, 
    message: any, 
    options: PublishOptions = {}
  ): Promise<void> {
    if (!this.isInitialized) {
      throw new Error('Message queue not initialized');
    }

    try {
      const messageValue = typeof message === 'string' ? message : JSON.stringify(message);
      
      await this.producer.send({
        topic,
        messages: [{
          key: options.key,
          value: messageValue,
          partition: options.partition,
          timestamp: options.timestamp || Date.now().toString(),
          headers: options.headers,
        }],
      });
      
      this.logger.debug(`Message published to topic ${topic}`, { messageLength: messageValue.length });
    } catch (error) {
      this.logger.error(`Failed to publish message to topic ${topic}:`, error);
      throw new Error(`Message publishing failed: ${error.message}`);
    }
  }

  async subscribe(
    topic: string, 
    groupId: string, 
    handler: MessageHandler,
    options: {
      fromBeginning?: boolean;
      autoCommit?: boolean;
      sessionTimeout?: number;
    } = {}
  ): Promise<void> {
    if (!this.isInitialized) {
      throw new Error('Message queue not initialized');
    }

    const consumerKey = `${topic}-${groupId}`;
    
    if (this.consumers.has(consumerKey)) {
      this.logger.warn(`Consumer already exists for topic ${topic} and group ${groupId}`);
      return;
    }

    try {
      const consumer = this.kafka.consumer({ 
        groupId,
        sessionTimeout: options.sessionTimeout || 30000,
        rebalanceTimeout: 60000,
        heartbeatInterval: 3000,
        retry: {
          initialRetryTime: 100,
          retries: 8,
        },
      });

      await consumer.connect();
      await consumer.subscribe({ 
        topic, 
        fromBeginning: options.fromBeginning || false 
      });

      await consumer.run({
        autoCommit: options.autoCommit !== false,
        eachMessage: async ({ topic, partition, message }) => {
          try {
            const messageValue = message.value?.toString();
            if (!messageValue) {
              this.logger.warn(`Empty message received from topic ${topic}`);
              return;
            }

            let parsedMessage: any;
            try {
              parsedMessage = JSON.parse(messageValue);
            } catch {
              // If not JSON, treat as plain text
              parsedMessage = messageValue;
            }

            const metadata: MessageMetadata = {
              topic,
              partition,
              offset: message.offset,
              timestamp: message.timestamp || Date.now().toString(),
              headers: this.parseHeaders(message.headers),
              key: message.key?.toString(),
            };

            await handler(parsedMessage, metadata);
            
            this.logger.debug(`Message processed from topic ${topic}`, {
              partition,
              offset: message.offset,
            });
          } catch (error) {
            this.logger.error(`Error processing message from topic ${topic}:`, error);
            
            // Implement dead letter queue logic here if needed
            await this.handleMessageError(topic, partition, message, error);
          }
        },
      });

      this.consumers.set(consumerKey, consumer);
      this.handlers.set(consumerKey, handler);
      
      this.logger.info(`✅ Subscribed to topic ${topic} with group ${groupId}`);
    } catch (error) {
      this.logger.error(`❌ Failed to subscribe to topic ${topic}:`, error);
      throw new Error(`Subscription failed: ${error.message}`);
    }
  }

  async unsubscribe(topic: string, groupId: string): Promise<void> {
    const key = `${topic}-${groupId}`;
    const consumer = this.consumers.get(key);
    
    if (consumer) {
      try {
        await consumer.disconnect();
        this.consumers.delete(key);
        this.handlers.delete(key);
        this.logger.info(`✅ Unsubscribed from topic ${topic} with group ${groupId}`);
      } catch (error) {
        this.logger.error(`Error unsubscribing from topic ${topic}:`, error);
        throw error;
      }
    }
  }

  async disconnect(): Promise<void> {
    try {
      this.logger.info('Disconnecting message queue service...');
      
      // Disconnect all consumers
      const disconnectPromises = Array.from(this.consumers.values()).map(consumer => 
        consumer.disconnect().catch(error => 
          this.logger.error('Error disconnecting consumer:', error)
        )
      );
      
      await Promise.all(disconnectPromises);
      this.consumers.clear();
      this.handlers.clear();

      // Disconnect producer
      await this.producer.disconnect();
      
      this.isInitialized = false;
      this.logger.info('✅ Message queue service disconnected');
    } catch (error) {
      this.logger.error('❌ Error disconnecting message queue service:', error);
      throw error;
    }
  }

  private parseHeaders(headers?: Record<string, Buffer>): Record<string, string> {
    if (!headers) return {};
    
    const parsedHeaders: Record<string, string> = {};
    for (const [key, value] of Object.entries(headers)) {
      parsedHeaders[key] = value.toString();
    }
    return parsedHeaders;
  }

  private async handleMessageError(
    topic: string, 
    partition: number, 
    message: KafkaMessage, 
    error: Error
  ): Promise<void> {
    // Implementation for dead letter queue or error handling
    this.logger.error('Message processing failed', {
      topic,
      partition,
      offset: message.offset,
      error: error.message,
    });
    
    // Could publish to dead letter topic here
    // await this.publishMessage(`${topic}.deadletter`, {
    //   originalMessage: message.value?.toString(),
    //   error: error.message,
    //   timestamp: new Date().toISOString(),
    // });
  }

  // Health check method
  public async checkHealth(): Promise<boolean> {
    try {
      if (!this.isInitialized) {
        return false;
      }
      
      // Try to get metadata to check connection
      const admin = this.kafka.admin();
      await admin.connect();
      await admin.listTopics();
      await admin.disconnect();
      
      return true;
    } catch (error) {
      this.logger.error('Message queue health check failed:', error);
      return false;
    }
  }
}

export const messageQueue = new MessageQueueService();