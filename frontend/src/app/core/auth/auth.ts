import { HttpClient } from '@angular/common/http';
import { Service, computed, inject, signal } from '@angular/core';
import { Observable, tap, throwError } from 'rxjs';
import { API_BASE_URL } from '../config/api-base-url.token';
import { Role } from './role';

export interface AuthenticatedUser {
  id: string;
  name: string;
  email: string;
  role: Role;
}

interface AuthResponse {
  accessToken: string;
  refreshToken: string;
  user: AuthenticatedUser;
}

interface RefreshResponse {
  accessToken: string;
  refreshToken: string;
}

interface StoredSession {
  user: AuthenticatedUser;
  accessToken: string;
  refreshToken: string;
}

const STORAGE_KEY = 'merchant-portal.session';

@Service()
export class Auth {
  private readonly http = inject(HttpClient);
  private readonly apiBaseUrl = inject(API_BASE_URL);

  private readonly user = signal<AuthenticatedUser | null>(null);
  private readonly accessToken = signal<string | null>(null);
  private readonly refreshToken = signal<string | null>(null);

  readonly currentUser = this.user.asReadonly();
  readonly role = computed(() => this.user()?.role ?? null);
  readonly isAuthenticated = computed(() => this.user() !== null);

  constructor() {
    this.restoreSession();
  }

  login(email: string, password: string): Observable<AuthResponse> {
    return this.http
      .post<AuthResponse>(`${this.apiBaseUrl}/auth/login`, { email, password })
      .pipe(tap((response) => this.setSession(response.user, response.accessToken, response.refreshToken)));
  }

  refreshSession(): Observable<RefreshResponse> {
    const refreshToken = this.refreshToken();
    if (!refreshToken) {
      return throwError(() => new Error('No refresh token available'));
    }

    return this.http
      .post<RefreshResponse>(`${this.apiBaseUrl}/auth/refresh`, { refreshToken })
      .pipe(
        tap((response) => {
          this.accessToken.set(response.accessToken);
          this.refreshToken.set(response.refreshToken);
          this.persist();
        }),
      );
  }

  logout(): void {
    this.http.post(`${this.apiBaseUrl}/auth/logout`, {}).subscribe({ error: () => undefined });
    this.clearSession();
  }

  getAccessToken(): string | null {
    return this.accessToken();
  }

  hasRole(...roles: Role[]): boolean {
    const current = this.role();
    return current !== null && roles.includes(current);
  }

  private setSession(user: AuthenticatedUser, accessToken: string, refreshToken: string): void {
    this.user.set(user);
    this.accessToken.set(accessToken);
    this.refreshToken.set(refreshToken);
    this.persist();
  }

  private clearSession(): void {
    this.user.set(null);
    this.accessToken.set(null);
    this.refreshToken.set(null);
    sessionStorage.removeItem(STORAGE_KEY);
  }

  private persist(): void {
    const session: StoredSession = {
      user: this.user()!,
      accessToken: this.accessToken()!,
      refreshToken: this.refreshToken()!,
    };
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(session));
  }

  private restoreSession(): void {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return;
    }
    try {
      const parsed = JSON.parse(raw) as StoredSession;
      this.user.set(parsed.user);
      this.accessToken.set(parsed.accessToken);
      this.refreshToken.set(parsed.refreshToken);
    } catch {
      sessionStorage.removeItem(STORAGE_KEY);
    }
  }
}
