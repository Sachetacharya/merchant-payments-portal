import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import {
  OnGatewayConnection,
  OnGatewayDisconnect,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import type { Server, Socket } from 'socket.io';
import type { ApplicationStatus } from './application.model.js';

@Injectable()
@WebSocketGateway({ cors: { origin: process.env.FRONTEND_ORIGIN ?? 'http://localhost:4200' } })
export class ApplicationsGateway implements OnGatewayConnection, OnGatewayDisconnect {
  private readonly logger = new Logger(ApplicationsGateway.name);

  @WebSocketServer()
  private server?: Server;

  constructor(
    private readonly jwtService: JwtService,
    private readonly config: ConfigService,
  ) {}

  async handleConnection(client: Socket): Promise<void> {
    const token = client.handshake.auth['token'] as string | undefined;
    if (!token) {
      client.disconnect(true);
      return;
    }
    try {
      await this.jwtService.verifyAsync(token, { secret: this.config.get<string>('JWT_ACCESS_SECRET') });
    } catch {
      client.disconnect(true);
    }
  }

  handleDisconnect(): void {}

  emitStatusChange(id: string, status: ApplicationStatus): void {
    if (!this.server) {
      this.logger.warn('Socket.IO server not yet initialized — dropping status broadcast');
      return;
    }
    this.server.emit('application.status-changed', { id, status });
  }
}
