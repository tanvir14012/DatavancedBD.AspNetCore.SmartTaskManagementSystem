import z from 'zod'

const evnSchema = z.object({
  VITE_API_BASE_URL: z.url(),
})

export const env = evnSchema.parse(import.meta.env)
