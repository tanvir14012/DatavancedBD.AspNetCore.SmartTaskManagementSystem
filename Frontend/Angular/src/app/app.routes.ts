import { Routes } from '@angular/router';
import { authGuard } from './core/guards/auth.guard';
import { noAuthGuard } from './core/guards/no-auth.guard';
import { projectWriteGuard } from './core/guards/project-role.guard';
import { taskBoardGuard } from './core/guards/task-board.guard';
import { AppShellComponent } from './features/layout/app-shell.component';

export const routes: Routes = [
  { path: '', redirectTo: 'homepage', pathMatch: 'full' },
  {
    path: 'homepage',
    loadComponent: () => import('./features/home/homepage.page').then((m) => m.HomepagePage),
    canActivate: [noAuthGuard],
  },
  {
    path: 'login',
    loadComponent: () => import('./features/auth/login.page').then((m) => m.LoginPage),
    canActivate: [noAuthGuard],
  },
  {
    path: 'register',
    loadComponent: () => import('./features/auth/register.page').then((m) => m.RegisterPage),
    canActivate: [noAuthGuard],
  },
  {
    path: '',
    component: AppShellComponent,
    canActivate: [authGuard],
    children: [
      { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
      {
        path: 'dashboard',
        loadComponent: () => import('./features/dashboard/dashboard.page').then((m) => m.DashboardPage)
      },
      {
        path: 'projects', redirectTo: 'projects/list', pathMatch: 'full',
      },
      {
        path: 'projects/list',
        loadComponent: () => import('./features/projects/projects.page').then((m) => m.ProjectsPage),
      },
      {
        path: 'projects/new',
        loadComponent: () => import('./features/projects/project-form.page').then((m) => m.ProjectFormPage),
        canActivate: [projectWriteGuard],
      },
      {
        path: 'projects/assign',
        loadComponent: () => import('./features/projects/project-assignments.page').then((m) => m.ProjectAssignmentsPage),
        canActivate: [projectWriteGuard],
      },
      {
        path: 'projects/:id',
        loadComponent: () => import('./features/projects/project-form.page').then((m) => m.ProjectFormPage),
      },
      {
        path: 'projects/:id/edit',
        loadComponent: () => import('./features/projects/project-form.page').then((m) => m.ProjectFormPage),
        canActivate: [projectWriteGuard],
      },
      {
        path: 'tasks/board',
        loadComponent: () => import('./features/tasks/task-board.page').then((m) => m.TaskBoardPage),
        canActivate: [taskBoardGuard],
      },
      {
        path: 'tasks/list',
        loadComponent: () => import('./features/tasks/tasks.page').then((m) => m.TasksPage),
      },
      {
        path: 'tasks', redirectTo: 'tasks/list', pathMatch: 'full',
      },
      {
        path: 'users/list',
        loadComponent: () => import('./features/users/users.page').then((m) => m.UsersPage)
      },
      {
        path: 'users', redirectTo: 'users/list', pathMatch: 'full'
      },
    ],
  },
  {
    path: '**',
    loadComponent: () => import('./features/not-found/not-found.component').then((m) => m.NotFoundPage),
    canActivate: [authGuard],
  },
];
