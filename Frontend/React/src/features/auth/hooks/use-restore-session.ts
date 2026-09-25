import { useAuthStore } from '@/store/use-auth-store'
import { useQuery } from '@tanstack/react-query'
import { refreshAccessToken } from '../api/auth-api'
import { useEffect } from 'react'

export function useRestoreSession() {
  const setAccessToken = useAuthStore((state) => state.setAccessToken)
  const clearSession = useAuthStore((state) => state.clearSession)

  const query = useQuery({
    queryKey: ['auth', 'session'],
    queryFn: refreshAccessToken,
    retry: false,
    refetchOnWindowFocus: false,
  })

  useEffect(() => {
    if (query.data) {
      setAccessToken(query.data.accessToken)
    }

    if (query.isError) {
      clearSession()
    }
  }, [query.data, query.isError, setAccessToken, clearSession])

  const accessToken = useAuthStore((state) => state.accessToken)

  return {
    isRestoring: query.isPending || (query.isSuccess && !accessToken),
  }
}
