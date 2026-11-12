import { Inject, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Redis } from 'ioredis';
import { REDIS_CLIENT } from '../redis/redis.provider';
import { EventsGateway } from './events.gateway';

@Injectable()
export class WsRedisBridgeService implements OnModuleInit {
  private readonly logger = new Logger(WsRedisBridgeService.name);
  private subscriber: Redis;

  constructor(
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
    private readonly eventsGateway: EventsGateway,
  ) {}

  onModuleInit(): void {
    this.subscriber = this.redis.duplicate();

    this.subscriber.subscribe('app-ws-events', (err) => {
      if (err) {
        this.logger.error(
          `Failed to subscribe to app-ws-events: ${err.message}`,
        );
      } else {
        this.logger.log('Subscribed to app-ws-events Redis channel');
      }
    });

    this.subscriber.on('message', (_channel: string, message: string) => {
      try {
        const { event, payload, room } = JSON.parse(message);
        if (room) {
          this.eventsGateway.broadcastToRoom(room, event, payload);
        }
      } catch (error) {
        this.logger.error(`Failed to process WS event: ${error}`);
      }
    });
  }
}
