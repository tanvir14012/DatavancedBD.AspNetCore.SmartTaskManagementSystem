import { useTranslation } from 'react-i18next'
import { useLoginMutation } from '../hooks/use-auth-mutations'
import { loginSchema, type LoginFormValues } from '../schemas/login-schema'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { LanguageSwitcher } from '@/components/shared/language-switcher'
import { useNavigate } from 'react-router'

export function LoginPage() {
  const { t } = useTranslation()
  const loginMutation = useLoginMutation()
  const navigate = useNavigate()

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
  })

  const onSubmit = (values: LoginFormValues) => {
    loginMutation.mutate(values, {
      onSuccess: () => navigate('/dashboard'),
    })
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-foreground p-6">
      <div className="absolute right-4 top-4">
        <LanguageSwitcher />
      </div>
      <section className="w-full max-w-md rounded-lg border border-border bg-card p-6 text-card-foreground shadow-sm">
        <h1 className="text-2xl font-bold">{t('auth.login.title')}</h1>

        <form className="mt-6 space-y-4" onSubmit={handleSubmit(onSubmit)}>
          <div className="space-y-2">
            <label htmlFor="email">{t('auth.login.email')}</label>

            <Input id="email" type="email" autoComplete="email" {...register('email')} />
            {errors.email && (
              <p className="text-sm text-red-600">
                {t(errors.email.message ?? 'auth.login.validation.emailInvalid')}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="password">{t('auth.login.password')}</Label>

            <Input
              id="password"
              type="password"
              autoComplete="current-password"
              {...register('password')}
            />

            {errors.password && (
              <p className="text-sm text-red-600">
                {t(errors.password.message ?? 'auth.login.validation.passwordRequired')}
              </p>
            )}
          </div>

          {loginMutation.isError && (
            <p className="text-sm text-red-600">{t('auth.login.validation.loginFailed')}</p>
          )}

          <Button className="w-full" type="submit" disabled={loginMutation.isPending}>
            {loginMutation.isPending ? t('auth.login.submitting') : t('auth.login.submit')}
          </Button>
        </form>
      </section>
    </main>
  )
}
