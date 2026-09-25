import { http } from '@/lib/http'
import type { PageResult } from '@/types/api'

export type UserListItem = {
  id: number
  firstName: string
  lastName: string
  email: string
  role: string
  isActive: boolean
  createdAt: string
}

export type UserInput = {
  firstName: string
  lastName: string
  email: string
  password?: string
  role?: string
}

export async function listUsers(params: Record<string, string | number | undefined> = {}) {
  const response = await http.get<PageResult<UserListItem>>('/api/users', { params })
  return response.data
}

export async function createUser(input: UserInput) {
  const response = await http.post('/api/users', input)
  return response.data
}

export async function updateUser({ id, input }: { id: number; input: UserInput }) {
  const response = await http.put(`/api/users/${id}`, input)
  return response.data
}

export async function deleteUser(id: number) {
  await http.delete(`/api/users/${id}`)
}
