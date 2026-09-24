import { LoginPage } from '@/features/auth/pages/login-page'
import { createBrowserRouter, Navigate } from 'react-router'
import { RequireAuth } from './require-auth'
import { RequireGuest } from './require-guest'
import { RequireRole } from './require-role'
import { AppShell } from '@/components/layouts/app-shell'
import { ComingSoonPage } from '@/shared/pages/coming-soon'
import { Homepage } from '@/features/home/pages/homepage'
import { RegisterPage } from '@/features/auth/pages/register-page'
import { DashboardPage } from '@/features/dashboard/pages/dashboard-page'
import { ProjectsPage } from '@/features/projects/pages/projects-page'
import { ProjectFormPage } from '@/features/projects/pages/project-form-page'
import { ProjectAssignmentsPage } from '@/features/projects/pages/project-assignments-page'
import { TasksPage } from '@/features/tasks/pages/tasks-page'
import { TaskBoardPage } from '@/features/tasks/pages/task-board-page'
import { UsersPage } from '@/features/users/pages/users-page'

export const router = createBrowserRouter([
  {
    path: '/',
    element: <Navigate to="/homepage" replace />,
  },
  {
    element: <RequireGuest />,
    children: [
      { path: '/homepage', element: <Homepage /> },
      { path: '/login', element: <LoginPage /> },
      { path: '/register', element: <RegisterPage /> },
    ],
  },
  {
    element: <RequireAuth />,
    children: [
      {
        element: <AppShell />,
        children: [
          {
            path: '/dashboard',
            element: <DashboardPage />,
          },
          { path: '/projects', element: <Navigate to="/projects/list" replace /> },
          { path: '/projects/list', element: <ProjectsPage /> },
          {
            element: <RequireRole roles={['Admin', 'Project Manager']} />,
            children: [
              { path: '/projects/new', element: <ProjectFormPage /> },
              { path: '/projects/assign', element: <ProjectAssignmentsPage /> },
            ],
          },
          { path: '/projects/:id/edit', element: <ProjectFormPage /> },
          { path: '/projects/:id', element: <ProjectFormPage /> },
          { path: '/tasks', element: <Navigate to="/tasks/list" replace /> },
          { path: '/tasks/list', element: <TasksPage /> },
          {
            element: <RequireRole roles={['Admin', 'Project Manager']} />,
            children: [{ path: '/tasks/board', element: <TaskBoardPage /> }],
          },
          { path: '/users', element: <Navigate to="/users/list" replace /> },
          { path: '/users/list', element: <UsersPage /> },
          {
            path: '*',
            element: <ComingSoonPage />,
          },
        ],
      },
    ],
  },
])
