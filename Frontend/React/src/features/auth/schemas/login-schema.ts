import z from 'zod'

export const loginSchema = z.object({
  email: z.email({
    error: 'auth.login.validation.emailInvalid',
  }),
  password: z.string().min(1, {
    error: 'auth.login.validation.passwordRequired',
  }),
})

export type LoginFormValues = z.infer<typeof loginSchema>
