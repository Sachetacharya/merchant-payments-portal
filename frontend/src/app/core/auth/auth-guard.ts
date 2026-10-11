import { inject } from '@angular/core';
import { CanActivateFn, CanMatchFn, Router, UrlTree } from '@angular/router';
import { Auth } from './auth';
import { Role } from './role';

function checkAccess(allowedRoles: Role[] | undefined): boolean | UrlTree {
  const auth = inject(Auth);
  const router = inject(Router);

  if (!auth.isAuthenticated()) {
    return router.createUrlTree(['/login']);
  }

  if (allowedRoles?.length && !auth.hasRole(...allowedRoles)) {
    return router.createUrlTree(['/forbidden']);
  }

  return true;
}

export const authGuard: CanActivateFn = (route) => {
  return checkAccess(route.data['roles'] as Role[] | undefined);
};

export const authMatchGuard: CanMatchFn = (route) => {
  return checkAccess(route.data?.['roles'] as Role[] | undefined);
};
