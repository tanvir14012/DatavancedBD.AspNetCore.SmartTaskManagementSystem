import { http } from '@/lib/http'

export type AuthUser = {
  id: number
  email: string
  firstName: string
  lastName: string
  roles: string[]
}

export type LoginRequest = {
  email: string
  password: string
}

export type LoginResponse = {
  user: AuthUser
  accessToken: string
  expiresIn: number
}

export type RefreshResponse = {
  accessToken: string
  expiresIn: string
}

export type LogoutResponse = {
  message: string
}

export async function login(request: LoginRequest) {
  const response = await http.post<LoginResponse>('/api/auth/login', request)
  return response.data
}

export async function refreshAccessToken() {
  const response = await http.post<RefreshResponse>('/api/auth/refresh')
  return response.data
}

export async function logout() {
  const response = await http.post<LogoutResponse>('/api/auth/logout')
  return response.data
}
