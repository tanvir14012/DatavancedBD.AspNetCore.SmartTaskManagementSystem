import { Routes } from '@angular/router';
import { authGuard } from '../../core/auth/auth.guard';

export const iamRoutes: Routes = [
  {
    path: 'roles',
    loadComponent: () => import('./roles/roles.component').then((m) => m.RolesComponent),
    canActivate: [authGuard],
    data: { breadcrumb: 'navigation.roles' },
  },
  {
    path: 'users',
    loadComponent: () => import('./users/users.component').then((m) => m.UsersComponent),
    canActivate: [authGuard],
    data: { breadcrumb: 'navigation.users' },
  },
];
