import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { listProjects } from '@/features/projects/api/project-api'
import { getTaskBoard, updateTask } from '@/features/tasks/api/task-api'

export function TaskBoardPage() {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const [projectId, setProjectId] = useState('all')
  const [priority, setPriority] = useState('all')
  const [search, setSearch] = useState('')
  const boardQuery = useQuery({ queryKey: ['tasks', 'board', { projectId, priority, search }], queryFn: () => getTaskBoard({ projectId: projectId === 'all' ? undefined : Number(projectId), priority: priority === 'all' ? undefined : priority, search: search || undefined }) })
  const projectsQuery = useQuery({ queryKey: ['projects', 'all'], queryFn: () => listProjects({ start: 0, length: 200 }) })
  const mutation = useMutation({ mutationFn: ({ id, status, task }: { id: number; status: string; task: { projectId: number; title: string; description?: string | null; priority: string; dueDate?: string | null } }) => updateTask({ id, input: { ...task, status } }), onSuccess: async () => { await queryClient.invalidateQueries({ queryKey: ['tasks', 'board'] }); await queryClient.invalidateQueries({ queryKey: ['tasks'] }); await queryClient.invalidateQueries({ queryKey: ['dashboard', 'summary'] }) } })

  return (
    <section className="space-y-6">
      <header><p className="text-sm font-semibold uppercase tracking-wide text-primary">{t('tasks.eyebrow')}</p><h1 className="text-3xl font-bold">{t('tasks.board')}</h1></header>
      <div className="grid gap-3 rounded-lg border border-border bg-card p-4 md:grid-cols-4"><select className="h-10 rounded-md border border-border bg-background px-3 text-sm" value={projectId} onChange={(event) => setProjectId(event.target.value)}><option value="all">{t('tasks.allProjects')}</option>{projectsQuery.data?.items.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}</select><select className="h-10 rounded-md border border-border bg-background px-3 text-sm" value={priority} onChange={(event) => setPriority(event.target.value)}><option value="all">{t('tasks.allPriorities')}</option><option value="Low">{t('tasks.priority.low')}</option><option value="Medium">{t('tasks.priority.medium')}</option><option value="High">{t('tasks.priority.high')}</option><option value="Critical">{t('tasks.priority.critical')}</option></select><Input placeholder={t('common.search')} value={search} onChange={(event) => setSearch(event.target.value)} /><Button variant="outline" onClick={() => boardQuery.refetch()}>{t('common.refresh')}</Button></div>
      {boardQuery.isPending && <p className="text-muted-foreground">{t('common.loading')}</p>}
      <div className="grid gap-4 overflow-x-auto md:grid-cols-2 xl:grid-cols-4">{boardQuery.data?.columns.map((column) => <article key={column.status} className="min-w-64 rounded-lg border border-border bg-card p-4"><header className="flex justify-between font-semibold"><span>{column.title || column.status}</span><span>{column.taskCount}</span></header><div className="mt-4 space-y-3">{column.tasks.map((task) => <div key={task.id} className="rounded-md border border-border bg-background p-3"><div className="flex justify-between gap-2"><strong className="text-sm">{task.title}</strong><span className="text-xs text-muted-foreground">{task.priority}</span></div><p className="mt-1 text-xs text-muted-foreground">{task.projectName}</p>{task.description && <p className="mt-2 text-sm">{task.description}</p>}{task.canEdit && <select className="mt-3 h-8 w-full rounded-md border border-border bg-card px-2 text-xs" value={task.status} onChange={(event) => mutation.mutate({ id: task.id, status: event.target.value, task })}><option value="Todo">{t('tasks.status.todo')}</option><option value="InProgress">{t('tasks.status.inProgress')}</option><option value="Completed">{t('tasks.status.completed')}</option><option value="Cancelled">{t('tasks.status.cancelled')}</option></select>}</div>)}</div></article>)}</div>
    </section>
  )
}
