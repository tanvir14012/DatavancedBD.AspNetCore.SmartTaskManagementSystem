import { Routes } from '@angular/router';
import { authGuard } from './core/auth/auth.guard';
import { MainLayoutComponent } from './layout/main-layout/main-layout.component';

export const routes: Routes = [
  // Public pages
  {
    path: 'home',
    loadComponent: () => import('./features/home/home').then((m) => m.HomeComponent),
  },
  {
    path: 'login',
    loadComponent: () => import('./features/auth/login.component').then((m) => m.LoginComponent),
  },
  {
    path: 'coming-soon',
    loadComponent: () =>
      import('./features/coming-soon/coming-soon.component').then((m) => m.ComingSoonComponent),
  },
  {
    path: 'not-found',
    loadComponent: () =>
      import('./features/not-found/not-found.component').then((m) => m.NotFoundComponent),
  },
  // Auth callback (handled by angular-oauth2-oidc)
  { path: 'callback', redirectTo: '/' },
  { path: 'logout', redirectTo: '/home' },
  // Protected app shell
  {
    path: '',
    component: MainLayoutComponent,
    canActivate: [authGuard],
    children: [
      { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
      {
        path: 'dashboard',
        loadChildren: () =>
          import('./features/dashboard/dashboard.routes').then((m) => m.dashboardRoutes),
        data: { breadcrumb: 'navigation.dashboard' },
      },
      {
        path: 'administration',
        loadChildren: () =>
          import('./features/administration/administration.routes').then(
            (m) => m.administrationRoutes,
          ),
        data: { breadcrumb: 'navigation.administration' },
      },
      {
        path: 'iam',
        loadChildren: () => import('./features/iam/iam.routes').then((m) => m.iamRoutes),
        data: { breadcrumb: 'navigation.administration' },
      },
      {
        path: 'operations',
        loadChildren: () =>
          import('./features/operations/operations.routes').then((m) => m.operationsRoutes),
      },
    ],
  },
  {
    path: 'forbidden',
    loadComponent: () =>
      import('./shared/components/empty-state/empty-state.component').then(
        (m) => m.EmptyStateComponent,
      ),
  },
  // 404 — must be last
  {
    path: '**',
    loadComponent: () =>
      import('./features/not-found/not-found.component').then((m) => m.NotFoundComponent),
  },
];
