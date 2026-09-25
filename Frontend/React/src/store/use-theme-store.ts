import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export type ThemeMode = 'light' | 'dark' | 'system'
export type Palette = 'blue' | 'violet' | 'green'

type ThemeState = {
  mode: ThemeMode
  palette: Palette
  setMode: (mode: ThemeMode) => void
  setPalette: (palette: Palette) => void
}

export const useThemeStore = create<ThemeState>()(
  persist(
    (set) => ({
      mode: 'system',
      palette: 'blue',
      setMode: (mode) => set({ mode }),
      setPalette: (palette) => set({ palette }),
    }),
    {
      name: 'stms-theme',
    },
  ),
)
