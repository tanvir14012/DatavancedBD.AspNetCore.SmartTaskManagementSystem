import { Routes } from '@angular/router';
import { authGuard } from '../../core/auth/auth.guard';
import { navigationBreadcrumbResolver } from '../../layout/breadcrumb/navigation-breadcrumb.resolver';

const operationBreadcrumb = [
  { placeholder: 'nav', dataKey: 'navigationBreadcrumb.navName' },
  { placeholder: 'rootSidebar', dataKey: 'navigationBreadcrumb.rootSidebarName' },
  { placeholder: 'nestedSidebar', dataKey: 'navigationBreadcrumb.nestedSidebarName' },
  { placeholder: 'featureName', dataKey: 'navigationBreadcrumb.featureLabelKey', translate: true },
];

export const operationsRoutes: Routes = [
  {
    path: ':module/:view',
    loadComponent: () =>
      import('./operations-workspace.component').then((m) => m.OperationsWorkspaceComponent),
    canActivate: [authGuard],
    resolve: { navigationBreadcrumb: navigationBreadcrumbResolver },
    data: { breadcrumb: operationBreadcrumb, breadcrumbFeature: 'operations.workspace' },
  },
  {
    path: ':module',
    loadComponent: () =>
      import('./operations-workspace.component').then((m) => m.OperationsWorkspaceComponent),
    canActivate: [authGuard],
    resolve: { navigationBreadcrumb: navigationBreadcrumbResolver },
    data: { breadcrumb: operationBreadcrumb, breadcrumbFeature: 'operations.workspace' },
  },
];
