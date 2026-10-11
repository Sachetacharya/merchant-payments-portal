import { Routes } from '@angular/router';
import { authGuard, authMatchGuard } from './core/auth/auth-guard';
import { Role } from './core/auth/role';
import { Shell } from './layout/shell/shell';

export const routes: Routes = [
  {
    path: 'login',
    loadComponent: () => import('./features/auth/login-page/login-page').then((m) => m.LoginPage),
  },
  {
    path: 'forbidden',
    loadComponent: () =>
      import('./features/forbidden/forbidden-page/forbidden-page').then((m) => m.ForbiddenPage),
  },
  {
    path: '',
    component: Shell,
    canActivate: [authGuard],
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'dashboard' },
      {
        path: 'dashboard',
        canMatch: [authMatchGuard],
        data: { roles: [Role.Sales, Role.Reviewer, Role.Admin] },
        loadComponent: () =>
          import('./features/dashboard/dashboard-page/dashboard-page').then((m) => m.DashboardPage),
      },
      {
        path: 'applications',
        canMatch: [authMatchGuard],
        data: { roles: [Role.Sales, Role.Reviewer, Role.Admin] },
        loadComponent: () =>
          import('./features/applications/applications-list-page/applications-list-page').then(
            (m) => m.ApplicationsListPage,
          ),
      },
      {
        path: 'applications/new',
        canMatch: [authMatchGuard],
        data: { roles: [Role.Sales] },
        loadComponent: () =>
          import('./features/application-wizard/application-wizard-page/application-wizard-page').then(
            (m) => m.ApplicationWizardPage,
          ),
      },
      {
        path: 'applications/:id/edit',
        canMatch: [authMatchGuard],
        data: { roles: [Role.Sales] },
        loadComponent: () =>
          import('./features/application-wizard/application-wizard-page/application-wizard-page').then(
            (m) => m.ApplicationWizardPage,
          ),
      },
      {
        path: 'applications/:id',
        canMatch: [authMatchGuard],
        data: { roles: [Role.Sales, Role.Reviewer, Role.Admin] },
        loadComponent: () =>
          import('./features/application-detail/application-detail-page/application-detail-page').then(
            (m) => m.ApplicationDetailPage,
          ),
      },
    ],
  },
  { path: '**', redirectTo: 'dashboard' },
];
