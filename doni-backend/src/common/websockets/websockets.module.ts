import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { EventsGateway } from './events.gateway';
import { WsPublisher } from './ws-publisher.service';
import { WsRedisBridgeService } from './ws-redis-bridge.service';

@Module({
  imports: [JwtModule],
  providers: [EventsGateway, WsPublisher, WsRedisBridgeService],
  exports: [EventsGateway, WsPublisher],
})
export class WebSocketsModule {}
