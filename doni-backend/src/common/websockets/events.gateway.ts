import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';

interface UserInfo {
  userId: string;
  role?: string;
}

@WebSocketGateway({
  cors: {
    origin: process.env.CORS_ORIGINS?.split(',') || '*',
    credentials: true,
  },
  namespace: '/events',
  transports: ['websocket', 'polling'],
})
export class EventsGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(EventsGateway.name);
  private readonly socketToUser = new Map<string, UserInfo>();

  constructor(private readonly jwtService: JwtService) {}

  afterInit(): void {
    this.logger.log('WebSocket Gateway initialized on /events namespace');
  }

  async handleConnection(client: Socket): Promise<void> {
    try {
      const queryToken = client.handshake.query.token;
      const authToken = client.handshake.auth?.token as string | undefined;
      const headerToken = client.handshake.headers.authorization?.replace(
        'Bearer ',
        '',
      );

      const token =
        (typeof queryToken === 'string' ? queryToken : undefined) ||
        authToken ||
        headerToken;

      if (!token) {
        this.logger.warn('Connection rejected: No token provided');
        client.disconnect();
        return;
      }

      const user = this.jwtService.verify<UserInfo>(token);
      if (!user?.userId) {
        this.logger.warn('Connection rejected: Invalid token');
        client.disconnect();
        return;
      }

      this.socketToUser.set(client.id, user);
      await client.join(`user:${user.userId}`);

      client.emit('connected', {
        message: 'Connected to events',
        timestamp: new Date().toISOString(),
      });

      this.logger.log(`User ${user.userId} connected (socket: ${client.id})`);
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      this.logger.error(`Connection error: ${err.message}`);
      client.disconnect();
    }
  }

  handleDisconnect(client: Socket): void {
    const user = this.socketToUser.get(client.id);
    if (user) {
      this.logger.log(`User ${user.userId} disconnected`);
      this.socketToUser.delete(client.id);
    }
  }

  broadcastToRoom(
    room: string,
    event: string,
    data: Record<string, unknown>,
  ): void {
    this.server.to(room).emit(event, data);
    this.logger.debug(`Broadcast ${event} to room ${room}`);
  }

  sendToUser(
    userId: string,
    event: string,
    data: Record<string, unknown>,
  ): void {
    this.server.to(`user:${userId}`).emit(event, data);
  }

  isUserOnline(userId: string): boolean {
    const room = this.server.sockets.adapter.rooms.get(`user:${userId}`);
    return room ? room.size > 0 : false;
  }
}
