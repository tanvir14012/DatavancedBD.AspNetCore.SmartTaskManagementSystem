import { http } from '@/lib/http'
import type { PageResult } from '@/types/api'

export type TaskItem = {
  id: number
  projectId: number
  projectName: string
  title: string
  description?: string | null
  status: string
  priority: string
  dueDate?: string | null
  createdAt: string
  canEdit: boolean
  canDelete: boolean
}

export type TaskInput = {
  projectId?: number
  title: string
  description?: string | null
  status?: string
  priority?: string
  dueDate?: string | null
  assigneeEmail?: string | null
}

export type TaskBoardCard = TaskItem & { assignees: string[] }
export type TaskBoardColumn = { status: string; title: string; taskCount: number; tasks: TaskBoardCard[] }
export type TaskBoard = { totalCount: number; columns: TaskBoardColumn[] }

export async function listTasks(params: Record<string, string | number | undefined> = {}) {
  const response = await http.get<PageResult<TaskItem>>('/api/tasks', { params })
  return response.data
}

export async function getTask(id: number) {
  const response = await http.get<TaskItem>(`/api/tasks/${id}`)
  return response.data
}

export async function createTask(input: Required<Pick<TaskInput, 'projectId'>> & Omit<TaskInput, 'projectId'>) {
  const response = await http.post('/api/tasks', input)
  return response.data
}

export async function updateTask({ id, input }: { id: number; input: TaskInput }) {
  const response = await http.put(`/api/tasks/${id}`, input)
  return response.data
}

export async function deleteTask(id: number) {
  await http.delete(`/api/tasks/${id}`)
}

export async function getTaskBoard(params: { projectId?: number; search?: string; priority?: string } = {}) {
  const response = await http.get<TaskBoard>('/api/tasks/board', { params })
  return response.data
}

export async function improveDescription(text: string) {
  const response = await http.post<{ improved: string }>('/api/ai/improve-description', { text })
  return response.data
}
