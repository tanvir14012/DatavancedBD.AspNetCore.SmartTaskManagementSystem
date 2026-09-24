import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export type Language = 'en' | 'bn'

type LanguageState = {
  language: Language
  setLanguage: (language: Language) => void
}

export const userLanguageStore = create<LanguageState>()(
  persist(
    (set) => ({
      language: 'en',
      setLanguage: (language) => set({ language }),
    }),
    {
      name: 'stms-language',
    },
  ),
)
