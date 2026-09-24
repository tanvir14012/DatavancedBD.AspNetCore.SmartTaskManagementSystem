import { http } from '@/lib/http'

export type DashboardBreakdownItem = {
  key: string
  value: number
}

export type DashboardUrgentTask = {
  id: number
  title: string
  status: string
  priority: string
  dueDate?: string | null
  projectId: number
}

export type DashboardSummary = {
  totalProjects: number
  totalTasks: number
  completedTasks: number
  pendingTasks: number
  statusBreakdown: DashboardBreakdownItem[]
  priorityBreakdown: DashboardBreakdownItem[]
  urgentTasks: DashboardUrgentTask[]
}

export async function getDashboardSummary(projectId?: number) {
  const response = await http.get<DashboardSummary>('/api/dashboard/summary', {
    params: projectId ? { projectId } : undefined,
  })
  return response.data
}
