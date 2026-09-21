import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'

import bn from '@/locales/bn.json'
import en from '@/locales/en.json'

void i18n.use(initReactI18next).init({
  resources: {
    en: { translation: en },
    bn: { translation: bn },
  },
  lng: 'en',
  fallbackLng: 'en',
  interpolation: {
    escapeValue: false,
  },
})

export { i18n }
