import { Navigate, Outlet } from 'react-router'

import { useAuthStore } from '@/store/use-auth-store'

export function RequireRole({ roles }: { roles: string[] }) {
  const user = useAuthStore((state) => state.user)
  return user && roles.some((role) => user.roles.includes(role) || user.role === role)
    ? <Outlet />
    : <Navigate to="/dashboard" replace />
}
