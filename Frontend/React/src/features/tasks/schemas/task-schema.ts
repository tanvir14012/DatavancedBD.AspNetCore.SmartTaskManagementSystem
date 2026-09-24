import { z } from 'zod'

export const taskSchema = z.object({
  projectId: z.coerce.number().int().positive('tasks.validation.projectRequired'),
  title: z.string().trim().min(1, 'tasks.validation.titleRequired').max(200, 'tasks.validation.titleTooLong'),
  description: z.string().max(5000, 'tasks.validation.descriptionTooLong').optional(),
  status: z.enum(['Todo', 'InProgress', 'Completed', 'Cancelled']),
  priority: z.enum(['Low', 'Medium', 'High', 'Critical']),
  dueDate: z.string().optional(),
  assigneeEmail: z.union([z.email('taskUi.assigneeInvalid'), z.literal('')]).optional(),
})

export type TaskFormValues = z.infer<typeof taskSchema>
export type TaskFormInput = z.input<typeof taskSchema>
