import { TestBed } from '@angular/core/testing';
import { ActivatedRouteSnapshot, Router, RouterStateSnapshot, UrlTree, provideRouter } from '@angular/router';
import { authGuard, authMatchGuard } from './auth-guard';
import { Auth } from './auth';
import { Role } from './role';

function createActivatedRouteSnapshot(roles: Role[] | undefined): ActivatedRouteSnapshot {
  return { data: { roles } } as unknown as ActivatedRouteSnapshot;
}

describe('authGuard / authMatchGuard', () => {
  let auth: { isAuthenticated: ReturnType<typeof vi.fn>; hasRole: ReturnType<typeof vi.fn> };
  let router: Router;

  beforeEach(() => {
    auth = {
      isAuthenticated: vi.fn().mockReturnValue(true),
      hasRole: vi.fn().mockReturnValue(true),
    };

    TestBed.configureTestingModule({
      providers: [provideRouter([]), { provide: Auth, useValue: auth }],
    });
    router = TestBed.inject(Router);
  });

  function runAuthGuard(roles?: Role[]) {
    return TestBed.runInInjectionContext(() =>
      authGuard(createActivatedRouteSnapshot(roles), {} as RouterStateSnapshot),
    );
  }

  function runAuthMatchGuard(roles?: Role[]) {
    return TestBed.runInInjectionContext(() => authMatchGuard({ data: { roles } } as any, [], {} as any));
  }

  it('redirects to /login when not authenticated', () => {
    auth.isAuthenticated.mockReturnValue(false);

    const result = runAuthGuard([Role.Admin]);

    expect(result).toBeInstanceOf(UrlTree);
    expect(router.serializeUrl(result as UrlTree)).toBe('/login');
  });

  it('redirects to /forbidden when authenticated but missing the required role', () => {
    auth.isAuthenticated.mockReturnValue(true);
    auth.hasRole.mockReturnValue(false);

    const result = runAuthGuard([Role.Admin]);

    expect(result).toBeInstanceOf(UrlTree);
    expect(router.serializeUrl(result as UrlTree)).toBe('/forbidden');
  });

  it('allows the request when authenticated and no roles are required', () => {
    auth.isAuthenticated.mockReturnValue(true);

    expect(runAuthGuard(undefined)).toBe(true);
    expect(auth.hasRole).not.toHaveBeenCalled();
  });

  it('allows the request when authenticated and the role matches', () => {
    auth.isAuthenticated.mockReturnValue(true);
    auth.hasRole.mockReturnValue(true);

    expect(runAuthGuard([Role.Sales, Role.Reviewer])).toBe(true);
    expect(auth.hasRole).toHaveBeenCalledWith(Role.Sales, Role.Reviewer);
  });

  it('authMatchGuard applies the same role check for lazy route matching', () => {
    auth.isAuthenticated.mockReturnValue(true);
    auth.hasRole.mockReturnValue(false);

    const result = runAuthMatchGuard([Role.Admin]);

    expect(result).toBeInstanceOf(UrlTree);
    expect(router.serializeUrl(result as UrlTree)).toBe('/forbidden');
  });
});
