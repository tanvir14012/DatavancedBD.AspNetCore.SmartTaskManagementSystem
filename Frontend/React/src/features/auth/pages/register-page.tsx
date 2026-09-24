import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { Link, useNavigate } from 'react-router'

import { LanguageSwitcher } from '@/components/shared/language-switcher'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useRegisterMutation } from '@/features/auth/hooks/use-auth-mutations'
import { getApiErrorMessage } from '@/utils/api-error'
import { useSyncTheme } from '@/hooks/use-sync-theme'

import { registerSchema, type RegisterFormValues } from '../schemas/register-schema'

export function RegisterPage() {
  useSyncTheme()
  const { t } = useTranslation()
  const navigate = useNavigate()
  const mutation = useRegisterMutation()

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<RegisterFormValues>({ resolver: zodResolver(registerSchema) })

  return (
    <main className="relative flex min-h-screen items-center justify-center bg-background p-6">
      <div className="absolute right-4 top-4">
        <LanguageSwitcher />
      </div>

      <section className="w-full max-w-lg rounded-lg border border-border bg-card p-6 text-card-foreground shadow-sm">
        <p className="text-sm font-semibold text-primary">Smart Task Management System</p>
        <h1 className="mt-2 text-2xl font-bold">{t('auth.register.title')}</h1>
        <p className="mt-2 text-sm text-muted-foreground">{t('auth.register.description')}</p>

        <form
          className="mt-6 space-y-4"
          onSubmit={handleSubmit((values) =>
            mutation.mutate(values, { onSuccess: () => navigate('/dashboard') }),
          )}
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="firstName">{t('auth.register.firstName')}</Label>
              <Input id="firstName" autoComplete="given-name" {...register('firstName')} />
              {errors.firstName && <p className="text-sm text-red-600">{t(errors.firstName.message ?? '')}</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="lastName">{t('auth.register.lastName')}</Label>
              <Input id="lastName" autoComplete="family-name" {...register('lastName')} />
              {errors.lastName && <p className="text-sm text-red-600">{t(errors.lastName.message ?? '')}</p>}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="email">{t('auth.login.email')}</Label>
            <Input id="email" type="email" autoComplete="email" {...register('email')} />
            {errors.email && <p className="text-sm text-red-600">{t(errors.email.message ?? '')}</p>}
          </div>

          <div className="space-y-2">
            <Label htmlFor="password">{t('auth.login.password')}</Label>
            <Input id="password" type="password" autoComplete="new-password" {...register('password')} />
            {errors.password && <p className="text-sm text-red-600">{t(errors.password.message ?? '')}</p>}
          </div>

          {mutation.isError && (
            <p className="text-sm text-red-600" role="alert">
              {getApiErrorMessage(mutation.error, t('auth.register.validation.failed'))}
            </p>
          )}

          <Button className="w-full" type="submit" disabled={mutation.isPending}>
            {mutation.isPending ? t('auth.register.submitting') : t('auth.register.submit')}
          </Button>

          <p className="text-center text-sm text-muted-foreground">
            {t('auth.register.existingAccount')}{' '}
            <Link className="font-medium text-primary hover:underline" to="/login">
              {t('auth.login.submit')}
            </Link>
          </p>
        </form>
      </section>
    </main>
  )
}
