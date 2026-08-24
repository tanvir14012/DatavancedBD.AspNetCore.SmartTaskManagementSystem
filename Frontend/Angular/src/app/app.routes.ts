import { Routes } from '@angular/router';
import { authGuard } from './core/guards/auth.guard';
import { AppShellComponent } from './features/layout/app-shell.component';

export const routes: Routes = [
  { path: '', redirectTo: 'homepage', pathMatch: 'full' },
  {
    path: 'homepage',
    loadComponent: () => import('./features/home/homepage.page').then((m) => m.HomepagePage),
  },
  {
    path: 'login',
    loadComponent: () => import('./features/auth/login.page').then((m) => m.LoginPage),
  },
  {
    path: 'register',
    loadComponent: () => import('./features/auth/register.page').then((m) => m.RegisterPage),
  },
  {
    path: '',
    component: AppShellComponent,
    canActivate: [authGuard],
    children: [
      { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
      {
        path: 'dashboard',
        loadComponent: () => import('./features/dashboard/dashboard.page').then((m) => m.DashboardPage),
      },
      {
        path: 'projects',
        loadComponent: () => import('./features/projects/projects.page').then((m) => m.ProjectsPage),
      },
      {
        path: 'tasks',
        loadComponent: () => import('./features/tasks/tasks.page').then((m) => m.TasksPage),
      },
      {
        path: 'users',
        loadComponent: () => import('./features/users/users.page').then((m) => m.UsersPage),
      },
    ],
  },
  {
    path: '**',
    loadComponent: () => import('./features/not-found/not-found.page').then((m) => m.NotFoundPage),
    canActivate: [authGuard],
  },
];
