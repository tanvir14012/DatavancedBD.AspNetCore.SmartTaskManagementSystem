import { create } from 'zustand'

type AuthUser = {
  id: number
  email: string
  firstName: string
  lastName: string
  roles: string[]
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
  user: null,
  setAccessToken: (accessToken) => set({ accessToken: accessToken }),
  setSession: (accessToken, user) => set({ accessToken, user }),
  clearSession: () => set({ accessToken: null, user: null }),
}))
