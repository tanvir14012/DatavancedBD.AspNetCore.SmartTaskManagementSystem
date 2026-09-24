import { useThemeStore } from '@/store/use-theme-store'
import { useEffect } from 'react'

export function useSyncTheme() {
  const mode = useThemeStore((state) => state.mode)

  useEffect(() => {
    const root = document.documentElement
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')

    const applyTheme = () => {
      const isDark = mode === 'dark' || (mode === 'system' && mediaQuery.matches)

      root.classList.toggle('dark', isDark)
    }

    applyTheme()
    mediaQuery.addEventListener('change', applyTheme)

    return () => {
      mediaQuery.removeEventListener('change', applyTheme)
    }
  }, [mode])
}
