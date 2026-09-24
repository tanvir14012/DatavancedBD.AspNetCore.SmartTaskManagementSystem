import { http } from '@/lib/http'

export type AuthUser = {
  id: number
  email: string
  firstName: string
  lastName: string
  role: string
  roles: string[]
  avatarUrl: string
}

export type LoginRequest = {
  email: string
  password: string
}

export type LoginResponse = {
  user: AuthUserPayload
  accessToken: string
  expiresIn: number
}

export type RefreshResponse = {
  accessToken: string
  expiresIn: number
}

export type RegisterRequest = {
  firstName: string
  lastName: string
  email: string
  password: string
}

type AuthUserPayload = {
  id: number
  email: string
  firstName?: string
  lastName?: string
  role?: string
  roles?: string[]
}

export type LogoutResponse = {
  message: string
}

export async function login(request: LoginRequest) {
  const response = await http.post<LoginResponse>('/api/auth/login', request)
  return {
    ...response.data,
    user: normalizeUser(response.data.user),
  }
}

export async function register(request: RegisterRequest) {
  const response = await http.post<LoginResponse>('/api/auth/register', request)
  return {
    ...response.data,
    user: normalizeUser(response.data.user),
  }
}

export async function refreshAccessToken() {
  const response = await http.post<RefreshResponse>('/api/auth/refresh')
  return response.data
}

export async function logout() {
  const response = await http.post<LogoutResponse>('/api/auth/logout')
  return response.data
}

function normalizeUser(user: AuthUserPayload): AuthUser {
  const roles = user.roles ?? (user.role ? [user.role] : ['Team Member'])
  const role = roles[0] ?? 'Team Member'

  return {
    id: user.id,
    email: user.email,
    firstName: user.firstName?.trim() ?? '',
    lastName: user.lastName?.trim() ?? '',
    role,
    roles,
    avatarUrl: `https://api.dicebear.com/9.x/initials/svg?seed=${encodeURIComponent(user.email)}`,
  }
}
