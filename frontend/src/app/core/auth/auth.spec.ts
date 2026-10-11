import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { API_BASE_URL } from '../config/api-base-url.token';
import { Auth } from './auth';
import { Role } from './role';

const API_BASE = 'http://localhost:3000';
const STORAGE_KEY = 'merchant-portal.session';

describe('Auth', () => {
  let service: Auth;
  let httpTesting: HttpTestingController;

  beforeEach(() => {
    sessionStorage.clear();
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: API_BASE_URL, useValue: API_BASE },
      ],
    });
    httpTesting = TestBed.inject(HttpTestingController);
    service = TestBed.inject(Auth);
  });

  afterEach(() => {
    httpTesting.verify();
    sessionStorage.clear();
  });

  it('should be created with no session initially', () => {
    expect(service).toBeTruthy();
    expect(service.isAuthenticated()).toBe(false);
    expect(service.currentUser()).toBeNull();
    expect(service.role()).toBeNull();
  });

  describe('login', () => {
    it('stores the session and exposes it via signals', () => {
      service.login('reviewer@merchantportal.test', 'Password123!').subscribe();

      const req = httpTesting.expectOne(`${API_BASE}/auth/login`);
      expect(req.request.method).toBe('POST');
      req.flush({
        accessToken: 'access-1',
        refreshToken: 'refresh-1',
        user: { id: 'u-1', name: 'Riya Reviewer', email: 'reviewer@merchantportal.test', role: Role.Reviewer },
      });

      expect(service.isAuthenticated()).toBe(true);
      expect(service.role()).toBe(Role.Reviewer);
      expect(service.getAccessToken()).toBe('access-1');
      expect(service.hasRole(Role.Reviewer)).toBe(true);
      expect(service.hasRole(Role.Sales)).toBe(false);
    });

    it('persists the session to sessionStorage', () => {
      service.login('admin@merchantportal.test', 'Password123!').subscribe();
      httpTesting
        .expectOne(`${API_BASE}/auth/login`)
        .flush({
          accessToken: 'a',
          refreshToken: 'r',
          user: { id: 'u-2', name: 'Avery Admin', email: 'admin@merchantportal.test', role: Role.Admin },
        });

      const stored = JSON.parse(sessionStorage.getItem(STORAGE_KEY)!);
      expect(stored.user.role).toBe(Role.Admin);
      expect(stored.accessToken).toBe('a');
    });

    it('does not update state when the login request errors', () => {
      service.login('sales@merchantportal.test', 'wrongpassword').subscribe({ error: () => undefined });
      httpTesting.expectOne(`${API_BASE}/auth/login`).flush('Unauthorized', { status: 401, statusText: 'Unauthorized' });

      expect(service.isAuthenticated()).toBe(false);
    });
  });

  it('restores a session already in sessionStorage on construction', () => {
    sessionStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        user: { id: 'u-3', name: 'Sam Sales', email: 'sales@merchantportal.test', role: Role.Sales },
        accessToken: 'restored-access',
        refreshToken: 'restored-refresh',
      }),
    );

    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: API_BASE_URL, useValue: API_BASE },
      ],
    });
    const restored = TestBed.inject(Auth);

    expect(restored.isAuthenticated()).toBe(true);
    expect(restored.role()).toBe(Role.Sales);
    expect(restored.getAccessToken()).toBe('restored-access');
  });

  describe('refreshSession', () => {
    it('errors synchronously-as-an-observable when there is no refresh token yet', () => {
      let caught: unknown;
      service.refreshSession().subscribe({ error: (err) => (caught = err) });
      expect(caught).toBeInstanceOf(Error);
      httpTesting.expectNone(`${API_BASE}/auth/refresh`);
    });

    it('updates the access token and re-persists on success', () => {
      service.login('reviewer@merchantportal.test', 'Password123!').subscribe();
      httpTesting
        .expectOne(`${API_BASE}/auth/login`)
        .flush({
          accessToken: 'access-1',
          refreshToken: 'refresh-1',
          user: { id: 'u-1', name: 'Riya Reviewer', email: 'reviewer@merchantportal.test', role: Role.Reviewer },
        });

      service.refreshSession().subscribe();
      httpTesting.expectOne(`${API_BASE}/auth/refresh`).flush({ accessToken: 'access-2', refreshToken: 'refresh-2' });

      expect(service.getAccessToken()).toBe('access-2');
      const stored = JSON.parse(sessionStorage.getItem(STORAGE_KEY)!);
      expect(stored.accessToken).toBe('access-2');
      expect(stored.refreshToken).toBe('refresh-2');
    });
  });

  describe('logout', () => {
    it('clears the session and sessionStorage even if the logout call fails', () => {
      service.login('admin@merchantportal.test', 'Password123!').subscribe();
      httpTesting
        .expectOne(`${API_BASE}/auth/login`)
        .flush({
          accessToken: 'a',
          refreshToken: 'r',
          user: { id: 'u-2', name: 'Avery Admin', email: 'admin@merchantportal.test', role: Role.Admin },
        });

      service.logout();
      httpTesting.expectOne(`${API_BASE}/auth/logout`).flush('error', { status: 500, statusText: 'Server Error' });

      expect(service.isAuthenticated()).toBe(false);
      expect(service.getAccessToken()).toBeNull();
      expect(sessionStorage.getItem(STORAGE_KEY)).toBeNull();
    });
  });
});
