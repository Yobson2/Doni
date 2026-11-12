import { Inject, Injectable, Logger } from '@nestjs/common';
import { Redis } from 'ioredis';
import { REDIS_CLIENT } from '../redis/redis.provider';

@Injectable()
export class WsPublisher {
  private readonly logger = new Logger(WsPublisher.name);
  private publisher: Redis;

  constructor(@Inject(REDIS_CLIENT) private redis: Redis) {}

  onModuleInit(): void {
    this.publisher = this.redis.duplicate();
    this.logger.log('Redis WebSocket publisher initialized');
  }

  async publishEvent(
    event: string,
    payload: unknown,
    room?: string,
  ): Promise<void> {
    try {
      await this.publisher.publish(
        'app-ws-events',
        JSON.stringify({ event, payload, room }),
      );
    } catch (error) {
      this.logger.error(`Failed to publish WS event: ${error}`);
    }
  }
}
