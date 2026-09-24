import { http } from '@/lib/http'
import type { PageResult } from '@/types/api'

export type ProjectListItem = {
  id: number
  name: string
  description?: string | null
  startDate?: string | null
  endDate?: string | null
  createdAt: string
  updatedAt?: string | null
  canEdit: boolean
  canDelete: boolean
  status: string
  role: string
  taskCount: number
  currentUserRole: string
}

export type ProjectMember = {
  userId: number
  userName: string
  email: string
  role: string
}

export type ProjectDetail = {
  id: number
  name: string
  description?: string | null
  startDate?: string | null
  endDate?: string | null
  createdAt: string
  canEdit: boolean
  canDelete: boolean
  members: ProjectMember[]
}

export type ProjectInput = {
  name: string
  description?: string | null
  startDate?: string | null
  endDate?: string | null
  isArchived?: boolean
}

export type ProjectAssignment = {
  projectId: number
  projectName: string
  userId: number
  userName: string
  email: string
  role: string
}

export type ProjectListParams = {
  start?: number
  length?: number
  search?: string
  sortColumn?: string
  sortDirection?: string
  status?: string
}

export async function listProjects(params: ProjectListParams = {}) {
  const response = await http.get<PageResult<ProjectListItem>>('/api/projects', { params })
  return response.data
}

export async function getProject(id: number) {
  const response = await http.get<ProjectDetail>(`/api/projects/${id}`)
  return response.data
}

export async function createProject(input: ProjectInput) {
  const response = await http.post<ProjectDetail>('/api/projects', input)
  return response.data
}

export async function updateProject({ id, input }: { id: number; input: ProjectInput }) {
  const response = await http.put<ProjectDetail>(`/api/projects/${id}`, input)
  return response.data
}

export async function deleteProject(id: number) {
  await http.delete(`/api/projects/${id}`)
}

export async function getProjectMembers(id: number) {
  const response = await http.get<ProjectMember[]>(`/api/projects/${id}/members`)
  return response.data
}

export async function listAssignments(params: { start?: number; length?: number; search?: string; role?: string; projectId?: number } = {}) {
  const response = await http.get<PageResult<ProjectAssignment>>('/api/projects/assignments', { params })
  return response.data
}

export async function assignProjectMember({ projectId, userId, role }: { projectId: number; userId: number; role: string }) {
  const response = await http.post(`/api/projects/${projectId}/members`, { userId, role })
  return response.data
}

export async function removeProjectMember({ projectId, userId }: { projectId: number; userId: number }) {
  await http.delete(`/api/projects/${projectId}/members/${userId}`)
}
