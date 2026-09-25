import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'

import bn from '@/locales/bn.json'
import en from '@/locales/en.json'
import { userLanguageStore } from '@/store/use-language-store'

void i18n.use(initReactI18next).init({
  resources: {
    en: { translation: en },
    bn: { translation: bn },
  },
  lng: userLanguageStore.getState().language,
  supportedLngs: ['en', 'bn'],
  fallbackLng: 'en',
  interpolation: {
    escapeValue: false,
  },
})

export { i18n }
