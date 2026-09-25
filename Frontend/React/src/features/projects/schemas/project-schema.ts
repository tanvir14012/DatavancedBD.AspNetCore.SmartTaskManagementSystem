import { z } from 'zod'

export const projectSchema = z
  .object({
    name: z.string().trim().min(1, 'projects.validation.nameRequired').max(200, 'projects.validation.nameTooLong'),
    description: z.string().max(2000, 'projects.validation.descriptionTooLong').optional(),
    startDate: z.string().optional(),
    endDate: z.string().optional(),
  })
  .refine((value) => !value.startDate || !value.endDate || value.endDate >= value.startDate, {
    path: ['endDate'],
    message: 'projects.validation.dateRange',
  })

export type ProjectFormValues = z.infer<typeof projectSchema>
