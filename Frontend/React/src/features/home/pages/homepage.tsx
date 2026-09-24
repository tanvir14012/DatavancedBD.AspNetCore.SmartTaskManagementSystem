import { Link } from 'react-router'
import { useTranslation } from 'react-i18next'

import { LanguageSwitcher } from '@/components/shared/language-switcher'
import { useSyncTheme } from '@/hooks/use-sync-theme'

export function Homepage() {
  useSyncTheme()
  const { t } = useTranslation()

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="flex items-center justify-between border-b border-border px-6 py-4 lg:px-12">
        <Link to="/homepage" className="font-bold">
          SmartTask
        </Link>

        <nav className="flex items-center gap-3" aria-label={t('common.mainNavigation')}>
          <LanguageSwitcher />
          <Link className="rounded-md px-3 py-2 text-sm hover:bg-muted" to="/login">
            {t('auth.login.submit')}
          </Link>
          <Link className="rounded-md bg-primary px-3 py-2 text-sm text-primary-foreground" to="/register">
            {t('auth.register.submit')}
          </Link>
        </nav>
      </header>

      <main className="mx-auto grid max-w-7xl gap-12 px-6 py-16 lg:grid-cols-2 lg:items-center lg:px-12">
        <section>
          <p className="text-sm font-semibold uppercase tracking-wide text-primary">
            {t('home.eyebrow')}
          </p>
          <h1 className="mt-4 text-4xl font-bold tracking-tight lg:text-6xl">
            {t('home.title')}
          </h1>
          <p className="mt-6 max-w-xl text-lg text-muted-foreground">
            {t('home.description')}
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link className="rounded-md bg-primary px-5 py-3 text-primary-foreground" to="/login">
              {t('home.loginCta')}
            </Link>
            <Link className="rounded-md border border-border px-5 py-3 hover:bg-muted" to="/register">
              {t('home.registerCta')}
            </Link>
          </div>
        </section>

        <div className="rounded-3xl border border-border bg-card p-6 shadow-xl">
          <div className="grid gap-4 sm:grid-cols-3">
            {['planning', 'visibility', 'insights'].map((key) => (
              <article key={key} className="rounded-xl bg-muted p-4">
                <h2 className="font-semibold">{t(`home.features.${key}.title`)}</h2>
                <p className="mt-2 text-sm text-muted-foreground">
                  {t(`home.features.${key}.description`)}
                </p>
              </article>
            ))}
          </div>
        </div>
      </main>
    </div>
  )
}
