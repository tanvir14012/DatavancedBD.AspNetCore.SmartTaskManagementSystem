import { create } from 'zustand'

import type { AuthUser } from '@/features/auth/api/auth-api'

const AUTH_USER_KEY = 'stms.auth-user'

function readStoredUser(): AuthUser | null {
  try {
    const value = localStorage.getItem(AUTH_USER_KEY)
    return value ? (JSON.parse(value) as AuthUser) : null
  } catch {
    return null
  }
}

type AuthState = {
  accessToken: string | null
  user: AuthUser | null
  setAccessToken: (accessToken: string) => void
  setSession: (accessToken: string, user: AuthUser) => void
  clearSession: () => void
}

export const useAuthStore = create<AuthState>((set) => ({
  accessToken: null,
  user: readStoredUser(),
  setAccessToken: (accessToken) => set({ accessToken: accessToken }),
  setSession: (accessToken, user) => {
    try {
      localStorage.setItem(AUTH_USER_KEY, JSON.stringify(user))
    } catch {
      // Continue with in-memory authentication when storage is unavailable.
    }
    set({ accessToken, user })
  },
  clearSession: () => {
    try {
      localStorage.removeItem(AUTH_USER_KEY)
    } catch {
      // Ignore storage access failures during logout.
    }
    set({ accessToken: null, user: null })
  },
}))
