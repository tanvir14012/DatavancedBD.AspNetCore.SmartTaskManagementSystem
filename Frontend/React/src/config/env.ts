import z from 'zod'

const evnSchema = z.object({
  VITE_API_BASE_URL: z.union([z.url(), z.literal('/services')]).default('/services'),
})

export const env = evnSchema.parse(import.meta.env)
