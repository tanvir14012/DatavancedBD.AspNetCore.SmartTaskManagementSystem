import { Routes } from '@angular/router';
import { authGuard } from '../../core/auth/auth.guard';

export const dashboardRoutes: Routes = [
  {
    path: '',
    loadComponent: () => import('./dashboard.component').then((m) => m.DashboardComponent),
    canActivate: [authGuard],
    data: { breadcrumb: 'navigation.dashboard' },
  },
];
