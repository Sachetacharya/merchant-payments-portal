import { Service, inject, signal } from '@angular/core';
import { Socket, io } from 'socket.io-client';
import { Auth } from '../auth/auth';
import { API_BASE_URL } from '../config/api-base-url.token';
import { ApplicationStatus } from '../applications/application.model';

export interface StatusChangedEvent {
  id: string;
  status: ApplicationStatus;
}

@Service()
export class Realtime {
  private readonly auth = inject(Auth);
  private readonly apiBaseUrl = inject(API_BASE_URL);
  private socket: Socket | null = null;

  readonly statusChanged = signal<StatusChangedEvent | null>(null);

  connect(): void {
    if (this.socket?.connected) {
      return;
    }
    const token = this.auth.getAccessToken();
    if (!token) {
      return;
    }
    this.socket = io(this.apiBaseUrl, { auth: { token } });
    this.socket.on('application.status-changed', (event: StatusChangedEvent) => {
      this.statusChanged.set(event);
    });
  }

  disconnect(): void {
    this.socket?.disconnect();
    this.socket = null;
  }
}
