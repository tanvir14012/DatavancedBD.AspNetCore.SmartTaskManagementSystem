import { Routes } from '@angular/router';
import { authGuard } from '../../core/auth/auth.guard';

export const administrationRoutes: Routes = [
  {
    path: 'module-navigation',
    loadComponent: () =>
      import('./module-navigation/module-navigation.component').then(
        (m) => m.ModuleNavigationComponent,
      ),
    canActivate: [authGuard],
    data: { breadcrumb: 'navigation.moduleNavigation' },
  },
  {
    path: 'departments',
    loadComponent: () =>
      import('./departments/departments.component').then((m) => m.DepartmentsComponent),
    canActivate: [authGuard],
    data: { breadcrumb: 'navigation.departments' },
  },
];
