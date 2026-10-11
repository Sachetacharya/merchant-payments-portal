import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { BehaviorSubject, catchError, filter, switchMap, take, throwError } from 'rxjs';
import { Auth } from '../auth/auth';

const AUTH_ENDPOINT_MARKERS = ['/auth/login', '/auth/refresh', '/auth/logout'];

let isRefreshing = false;
const refreshedAccessToken$ = new BehaviorSubject<string | null>(null);

function isAuthEndpoint(url: string): boolean {
  return AUTH_ENDPOINT_MARKERS.some((marker) => url.includes(marker));
}

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const auth = inject(Auth);
  const router = inject(Router);

  const skipAuth = isAuthEndpoint(req.url);
  const token = auth.getAccessToken();
  const authedReq = token && !skipAuth ? req.clone({ setHeaders: { Authorization: `Bearer ${token}` } }) : req;

  return next(authedReq).pipe(
    catchError((error: unknown) => {
      if (!(error instanceof HttpErrorResponse) || error.status !== 401 || skipAuth) {
        return throwError(() => error);
      }

      if (isRefreshing) {
        return refreshedAccessToken$.pipe(
          filter((newToken): newToken is string => newToken !== null),
          take(1),
          switchMap((newToken) => next(req.clone({ setHeaders: { Authorization: `Bearer ${newToken}` } }))),
        );
      }

      isRefreshing = true;
      refreshedAccessToken$.next(null);

      return auth.refreshSession().pipe(
        switchMap((response) => {
          isRefreshing = false;
          refreshedAccessToken$.next(response.accessToken);
          return next(req.clone({ setHeaders: { Authorization: `Bearer ${response.accessToken}` } }));
        }),
        catchError((refreshError: unknown) => {
          isRefreshing = false;
          refreshedAccessToken$.next(null);
          auth.logout();
          router.navigateByUrl('/login');
          return throwError(() => refreshError);
        }),
      );
    }),
  );
};
