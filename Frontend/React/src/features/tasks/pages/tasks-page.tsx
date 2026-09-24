import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { useSearchParams } from 'react-router'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { listProjects } from '@/features/projects/api/project-api'
import { createTask, deleteTask, getTask, improveDescription, listTasks, updateTask } from '@/features/tasks/api/task-api'
import { getApiErrorMessage } from '@/utils/api-error'

import { taskSchema, type TaskFormInput, type TaskFormValues } from '../schemas/task-schema'

export function TasksPage() {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const [searchParams, setSearchParams] = useSearchParams()
  const taskId = Number(searchParams.get('taskId')) || undefined
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('all')
  const [priority, setPriority] = useState('all')
  const [page, setPage] = useState(1)
  const pageSize = 10

  const tasksQuery = useQuery({ queryKey: ['tasks', { search, status, priority, page }], queryFn: () => listTasks({ search: search || undefined, status: status === 'all' ? undefined : status, priority: priority === 'all' ? undefined : priority, start: (page - 1) * pageSize, length: pageSize }) })
  const projectsQuery = useQuery({ queryKey: ['projects', 'all'], queryFn: () => listProjects({ start: 0, length: 200 }) })
  const taskQuery = useQuery({ queryKey: ['tasks', taskId], queryFn: () => getTask(taskId!), enabled: Boolean(taskId) })
  const mutation = useMutation({ mutationFn: (values: TaskFormValues) => taskId ? updateTask({ id: taskId, input: values }) : createTask(values), onSuccess: async () => { await queryClient.invalidateQueries({ queryKey: ['tasks'] }); await queryClient.invalidateQueries({ queryKey: ['dashboard', 'summary'] }); setSearchParams({}); reset() } })
  const improveMutation = useMutation({ mutationFn: improveDescription })
  const deleteMutation = useMutation({ mutationFn: (id: number) => deleteTask(id), onSuccess: async () => { await queryClient.invalidateQueries({ queryKey: ['tasks'] }); await queryClient.invalidateQueries({ queryKey: ['dashboard', 'summary'] }) } })

  const { register, reset, getValues, setValue, handleSubmit, formState: { errors } } = useForm<TaskFormInput, unknown, TaskFormValues>({ resolver: zodResolver(taskSchema), defaultValues: { projectId: 0, title: '', description: '', status: 'Todo', priority: 'Medium', dueDate: '', assigneeEmail: '' } })

  useEffect(() => {
    if (taskQuery.data) reset({ projectId: taskQuery.data.projectId, title: taskQuery.data.title, description: taskQuery.data.description ?? '', status: taskQuery.data.status as TaskFormValues['status'], priority: taskQuery.data.priority as TaskFormValues['priority'], dueDate: taskQuery.data.dueDate ?? '', assigneeEmail: '' })
    if (!taskId) reset({ projectId: 0, title: '', description: '', status: 'Todo', priority: 'Medium', dueDate: '', assigneeEmail: '' })
  }, [taskQuery.data, taskId, reset])

  const tasks = tasksQuery.data?.items ?? []
  const totalPages = Math.max(tasksQuery.data?.totalPages ?? 1, 1)

  return (
    <section className="space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-sm font-semibold uppercase tracking-wide text-primary">{t('tasks.eyebrow')}</p><h1 className="text-3xl font-bold">{t('tasks.title')}</h1></div><Button onClick={() => setSearchParams({ taskId: 'new' })}>{t('tasks.new')}</Button></header>

      {searchParams.has('taskId') && (
        <form className="space-y-4 rounded-lg border border-border bg-card p-5" onSubmit={handleSubmit((values) => mutation.mutate(values))}>
          <h2 className="text-xl font-semibold">{taskId ? t('tasks.edit') : t('tasks.create')}</h2>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2"><Label htmlFor="task-project">{t('tasks.project')}</Label><select id="task-project" className="h-10 w-full rounded-md border border-border bg-background px-3 text-sm" {...register('projectId')}><option value={0}>{t('tasks.selectProject')}</option>{projectsQuery.data?.items.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}</select>{errors.projectId && <p className="text-sm text-red-600">{t(errors.projectId.message ?? '')}</p>}</div>
            <div className="space-y-2"><Label htmlFor="task-title">{t('tasks.fields.title')}</Label><Input id="task-title" {...register('title')} />{errors.title && <p className="text-sm text-red-600">{t(errors.title.message ?? '')}</p>}</div>
            <div className="space-y-2"><Label htmlFor="task-status">{t('tasks.fields.status')}</Label><select id="task-status" className="h-10 w-full rounded-md border border-border bg-background px-3 text-sm" {...register('status')}><option value="Todo">{t('tasks.status.todo')}</option><option value="InProgress">{t('tasks.status.inProgress')}</option><option value="Completed">{t('tasks.status.completed')}</option><option value="Cancelled">{t('tasks.status.cancelled')}</option></select></div>
            <div className="space-y-2"><Label htmlFor="task-priority">{t('tasks.fields.priority')}</Label><select id="task-priority" className="h-10 w-full rounded-md border border-border bg-background px-3 text-sm" {...register('priority')}><option value="Low">{t('tasks.priority.low')}</option><option value="Medium">{t('tasks.priority.medium')}</option><option value="High">{t('tasks.priority.high')}</option><option value="Critical">{t('tasks.priority.critical')}</option></select></div>
            <div className="space-y-2"><Label htmlFor="task-due">{t('tasks.fields.dueDate')}</Label><Input id="task-due" type="date" {...register('dueDate')} /></div>
          </div>
          <div className="space-y-2"><Label htmlFor="task-assignee">{t('taskUi.assigneeEmail')}</Label><Input id="task-assignee" type="email" placeholder="name@company.com" {...register('assigneeEmail')} />{errors.assigneeEmail && <p className="text-sm text-red-600">{t(errors.assigneeEmail.message ?? '')}</p>}</div>
          <div className="space-y-2"><Label htmlFor="task-description">{t('tasks.fields.description')}</Label><textarea id="task-description" rows={4} className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm" {...register('description')} /><Button type="button" variant="outline" disabled={improveMutation.isPending} onClick={() => { const text = getValues('description') ?? ''; if (text.trim()) improveMutation.mutate(text, { onSuccess: (result) => setValue('description', result.improved) }) }}>{improveMutation.isPending ? t('taskUi.improving') : t('taskUi.improve')}</Button></div>
          {mutation.isError && <p className="text-sm text-red-600" role="alert">{getApiErrorMessage(mutation.error, t('tasks.saveFailed'))}</p>}
          <div className="flex gap-2"><Button type="submit" disabled={mutation.isPending}>{mutation.isPending ? t('common.saving') : t('common.save')}</Button><Button type="button" variant="outline" onClick={() => setSearchParams({})}>{t('common.cancel')}</Button></div>
        </form>
      )}

      <div className="grid gap-3 rounded-lg border border-border bg-card p-4 md:grid-cols-3"><Input placeholder={t('common.search')} value={search} onChange={(event) => { setPage(1); setSearch(event.target.value) }} /><select className="h-10 rounded-md border border-border bg-background px-3 text-sm" value={status} onChange={(event) => { setPage(1); setStatus(event.target.value) }}><option value="all">{t('common.all')}</option><option value="Todo">{t('tasks.status.todo')}</option><option value="InProgress">{t('tasks.status.inProgress')}</option><option value="Completed">{t('tasks.status.completed')}</option><option value="Cancelled">{t('tasks.status.cancelled')}</option></select><select className="h-10 rounded-md border border-border bg-background px-3 text-sm" value={priority} onChange={(event) => { setPage(1); setPriority(event.target.value) }}><option value="all">{t('common.all')}</option><option value="Low">{t('tasks.priority.low')}</option><option value="Medium">{t('tasks.priority.medium')}</option><option value="High">{t('tasks.priority.high')}</option><option value="Critical">{t('tasks.priority.critical')}</option></select></div>

      {tasksQuery.isPending && <p className="text-muted-foreground">{t('common.loading')}</p>}
      <div className="overflow-x-auto rounded-lg border border-border bg-card"><table className="w-full text-left text-sm"><thead className="border-b border-border text-muted-foreground"><tr><th className="p-3">{t('tasks.fields.title')}</th><th className="p-3">{t('tasks.project')}</th><th className="p-3">{t('tasks.fields.status')}</th><th className="p-3">{t('tasks.fields.priority')}</th><th className="p-3">{t('common.actions')}</th></tr></thead><tbody>{tasks.map((task) => <tr key={task.id} className="border-b border-border last:border-0"><td className="p-3"><strong>{task.title}</strong>{task.description && <p className="mt-1 text-xs text-muted-foreground">{task.description}</p>}</td><td className="p-3">{task.projectName}</td><td className="p-3">{task.status}</td><td className="p-3">{task.priority}</td><td className="flex gap-2 p-3">{task.canEdit && <Button variant="outline" onClick={() => setSearchParams({ taskId: String(task.id) })}>{t('common.edit')}</Button>}{task.canDelete && <Button variant="outline" onClick={() => window.confirm(t('tasks.deleteConfirm')) && deleteMutation.mutate(task.id)}>{t('common.delete')}</Button>}</td></tr>)}</tbody></table></div>
      {totalPages > 1 && <div className="flex items-center justify-center gap-4"><Button variant="outline" disabled={page === 1} onClick={() => setPage((value) => value - 1)}>{t('common.previous')}</Button><span className="text-sm text-muted-foreground">{t('common.pageOf', { page, total: totalPages })}</span><Button variant="outline" disabled={page >= totalPages} onClick={() => setPage((value) => value + 1)}>{t('common.next')}</Button></div>}
    </section>
  )
}
