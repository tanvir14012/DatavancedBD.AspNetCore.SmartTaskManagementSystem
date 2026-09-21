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
