import { z } from 'zod'

export const registerSchema = z.object({
  firstName: z.string().trim().max(100, { error: 'auth.register.validation.firstNameTooLong' }),
  lastName: z.string().trim().max(100, { error: 'auth.register.validation.lastNameTooLong' }),
  email: z.email({ error: 'auth.register.validation.emailInvalid' }),
  password: z
    .string()
    .min(8, { error: 'auth.register.validation.passwordMin' })
    .regex(/[A-Z]/, { error: 'auth.register.validation.passwordUpper' })
    .regex(/[a-z]/, { error: 'auth.register.validation.passwordLower' })
    .regex(/[0-9]/, { error: 'auth.register.validation.passwordDigit' })
    .regex(/[!@#$%^&*]/, { error: 'auth.register.validation.passwordSpecial' }),
})

export type RegisterFormValues = z.infer<typeof registerSchema>
