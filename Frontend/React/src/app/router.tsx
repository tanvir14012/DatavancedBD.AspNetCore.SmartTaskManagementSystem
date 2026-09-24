import { LoginPage } from '@/features/auth/pages/login-page'
import { createBrowserRouter, Navigate } from 'react-router'
import { RequireAuth } from './require-auth'
import { Dashboard } from '@/features/auth/pages/dashboard-page'
import { AppShell } from '@/components/layouts/app-shell'
import { ComingSoonPage } from '@/shared/pages/coming-soon'

export const router = createBrowserRouter([
  {
    path: '/',
    element: <Navigate to="/login" replace />,
  },
  {
    path: '/login',
    element: <LoginPage />,
  },
  {
    element: <RequireAuth />,
    children: [
      {
        element: <AppShell />,
        children: [
          {
            path: '/dashboard',
            element: <Dashboard />,
          },
          {
            path: '*',
            element: <ComingSoonPage />,
          },
        ],
      },
    ],
  },
])
