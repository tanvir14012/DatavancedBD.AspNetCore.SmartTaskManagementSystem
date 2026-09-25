import { userLanguageStore, type Language } from '@/store/use-language-store'
import { useTranslation } from 'react-i18next'

export function LanguageSwitcher() {
  const { i18n, t } = useTranslation()

  const language = userLanguageStore((state) => state.language)
  const setLanguage = userLanguageStore((state) => state.setLanguage)

  const changeLanguage = (nextLang: Language) => {
    setLanguage(nextLang)
    void i18n.changeLanguage(nextLang)
  }

  return (
    <select
      aria-label={t('common.language')}
      className="h-8 rounded-md border border-border bg-background px-2 text-xs text-foreground"
      value={language}
      onChange={(e) => changeLanguage(e.target.value as Language)}
    >
      <option value="en">EN</option>
      <option value="bn">বাং</option>
    </select>
  )
}
