import { env } from '@/config/env'
import { useAuthStore } from '@/store/use-auth-store'
import axios from 'axios'

export const http = axios.create({
  baseURL: env.VITE_API_BASE_URL,
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
})

http.interceptors.request.use((config) => {
  const accessToken = useAuthStore.getState().accessToken

  if (accessToken) {
    config.headers.Authorization = `Bearer ${accessToken}`
  }

  return config
})

let refreshPromise: Promise<string> | null = null

http.interceptors.response.use(
  (response) => response,
  async (error: unknown) => {
    if (!axios.isAxiosError(error) || error.response?.status !== 401) {
      return Promise.reject(error)
    }

    const request = error.config
    const requestUrl = request?.url ?? ''

    if (!request || requestUrl.includes('/api/auth/')) {
      return Promise.reject(error)
    }

    const retryRequest = request as typeof request & { _stmsRetried?: boolean }
    if (retryRequest._stmsRetried) {
      return Promise.reject(error)
    }

    retryRequest._stmsRetried = true

    try {
      refreshPromise ??= axios
        .post<{ accessToken: string }>(`${env.VITE_API_BASE_URL}/api/auth/refresh`, {}, { withCredentials: true })
        .then((response) => {
          useAuthStore.getState().setAccessToken(response.data.accessToken)
          return response.data.accessToken
        })
        .finally(() => {
          refreshPromise = null
        })

      const accessToken = await refreshPromise
      retryRequest.headers = retryRequest.headers ?? {}
      retryRequest.headers.Authorization = `Bearer ${accessToken}`
      return http(retryRequest)
    } catch (refreshError) {
      useAuthStore.getState().clearSession()
      return Promise.reject(refreshError)
    }
  },
)
