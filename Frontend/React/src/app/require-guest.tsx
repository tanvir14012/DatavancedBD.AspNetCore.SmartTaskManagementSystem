import { Navigate, Outlet } from 'react-router'

import { useAuthStore } from '@/store/use-auth-store'

export function RequireGuest() {
  const accessToken = useAuthStore((state) => state.accessToken)
  return accessToken ? <Navigate to="/dashboard" replace /> : <Outlet />
}
