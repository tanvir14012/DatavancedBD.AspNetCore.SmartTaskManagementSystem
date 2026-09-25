import { useRestoreSession } from '@/features/auth/hooks/use-restore-session'
import { useAuthStore } from '@/store/use-auth-store'
import { Navigate, Outlet } from 'react-router'

export function RequireAuth() {
  const accessToken = useAuthStore((state) => state.accessToken)
  const { isRestoring } = useRestoreSession()

  if (isRestoring) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-background text-foreground">
        Restoring session...
      </main>
    )
  }

  if (!accessToken) {
    return <Navigate to="/login"></Navigate>
  }

  return <Outlet />
}
