import { HttpClient, HttpErrorResponse, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { Subject, of, throwError } from 'rxjs';
import { Auth } from '../auth/auth';
import { authInterceptor } from './auth-interceptor';

describe('authInterceptor', () => {
  let httpClient: HttpClient;
  let httpTesting: HttpTestingController;
  let auth: {
    getAccessToken: ReturnType<typeof vi.fn>;
    refreshSession: ReturnType<typeof vi.fn>;
    logout: ReturnType<typeof vi.fn>;
  };
  let router: { navigateByUrl: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    auth = {
      getAccessToken: vi.fn().mockReturnValue('initial-token'),
      refreshSession: vi.fn(),
      logout: vi.fn(),
    };
    router = { navigateByUrl: vi.fn() };

    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([authInterceptor])),
        provideHttpClientTesting(),
        { provide: Auth, useValue: auth },
        { provide: Router, useValue: router },
      ],
    });

    httpClient = TestBed.inject(HttpClient);
    httpTesting = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpTesting.verify();
  });

  it('attaches the bearer token to an ordinary request', () => {
    httpClient.get('/api/applications').subscribe();

    const req = httpTesting.expectOne('/api/applications');
    expect(req.request.headers.get('Authorization')).toBe('Bearer initial-token');
    req.flush({});
  });

  it('does not attach a token to the login/refresh/logout endpoints', () => {
    httpClient.post('/api/auth/login', {}).subscribe();

    const req = httpTesting.expectOne('/api/auth/login');
    expect(req.request.headers.has('Authorization')).toBe(false);
    req.flush({});
  });

  it('does not attempt a refresh for non-401 errors', () => {
    httpClient.get('/api/applications').subscribe({ error: () => undefined });

    httpTesting.expectOne('/api/applications').flush('server error', {
      status: 500,
      statusText: 'Internal Server Error',
    });

    expect(auth.refreshSession).not.toHaveBeenCalled();
  });

  it('refreshes once and retries the original request on a single 401', () => {
    auth.refreshSession.mockReturnValue(of({ accessToken: 'new-token', refreshToken: 'new-refresh' }));

    httpClient.get('/api/applications').subscribe();

    httpTesting
      .expectOne('/api/applications')
      .flush('unauthorized', { status: 401, statusText: 'Unauthorized' });

    expect(auth.refreshSession).toHaveBeenCalledTimes(1);

    const retried = httpTesting.expectOne('/api/applications');
    expect(retried.request.headers.get('Authorization')).toBe('Bearer new-token');
    retried.flush({ ok: true });
  });

  it('queues concurrent 401s behind a single refresh call instead of firing multiple refreshes', () => {
    const refreshSubject = new Subject<{ accessToken: string; refreshToken: string }>();
    auth.refreshSession.mockReturnValue(refreshSubject.asObservable());

    httpClient.get('/api/a').subscribe();
    httpClient.get('/api/b').subscribe();
    httpClient.get('/api/c').subscribe();

    const reqA = httpTesting.expectOne('/api/a');
    const reqB = httpTesting.expectOne('/api/b');
    const reqC = httpTesting.expectOne('/api/c');

    reqA.flush('unauthorized', { status: 401, statusText: 'Unauthorized' });
    reqB.flush('unauthorized', { status: 401, statusText: 'Unauthorized' });
    reqC.flush('unauthorized', { status: 401, statusText: 'Unauthorized' });

    expect(auth.refreshSession).toHaveBeenCalledTimes(1);

    refreshSubject.next({ accessToken: 'new-token', refreshToken: 'new-refresh' });
    refreshSubject.complete();

    const retriedA = httpTesting.expectOne('/api/a');
    const retriedB = httpTesting.expectOne('/api/b');
    const retriedC = httpTesting.expectOne('/api/c');
    for (const retried of [retriedA, retriedB, retriedC]) {
      expect(retried.request.headers.get('Authorization')).toBe('Bearer new-token');
      retried.flush({ ok: true });
    }
  });

  it('logs out and redirects to /login when the refresh itself fails', () => {
    auth.refreshSession.mockReturnValue(throwError(() => new HttpErrorResponse({ status: 401 })));

    let caughtError: unknown;
    httpClient.get('/api/applications').subscribe({ error: (err) => (caughtError = err) });

    httpTesting
      .expectOne('/api/applications')
      .flush('unauthorized', { status: 401, statusText: 'Unauthorized' });

    expect(auth.logout).toHaveBeenCalled();
    expect(router.navigateByUrl).toHaveBeenCalledWith('/login');
    expect(caughtError).toBeTruthy();
  });

  it('never retries a 401 on the logout endpoint itself (regression test)', () => {
    httpClient.post('/api/auth/logout', {}).subscribe({ error: () => undefined });

    httpTesting
      .expectOne('/api/auth/logout')
      .flush('unauthorized', { status: 401, statusText: 'Unauthorized' });

    expect(auth.refreshSession).not.toHaveBeenCalled();
  });
});
