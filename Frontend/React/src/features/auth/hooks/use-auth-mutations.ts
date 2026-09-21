import { useAuthStore } from '@/store/use-auth-store'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { login, logout, type LoginRequest } from '../api/auth-api'

export function useLoginMutation() {
  const setSession = useAuthStore((state) => state.setSession)

  return useMutation({
    mutationFn: (request: LoginRequest) => login(request),
    onSuccess: (response) => {
      setSession(response.accessToken, response.user)
    },
  })
}

export function useLogoutMutation() {
  const queryClient = useQueryClient()
  const clearSession = useAuthStore((state) => state.clearSession)

  return useMutation({
    mutationFn: logout,
    onSuccess: () => {
      clearSession()
      queryClient.clear()
    },
  })
}
