import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { useNavigate, useParams } from 'react-router'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { assignProjectMember, createProject, deleteProject, getProject, removeProjectMember, updateProject } from '@/features/projects/api/project-api'
import { useAuthStore } from '@/store/use-auth-store'
import { getApiErrorMessage } from '@/utils/api-error'

import { projectSchema, type ProjectFormValues } from '../schemas/project-schema'

export function ProjectFormPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { id } = useParams()
  const projectId = id ? Number(id) : undefined
  const editing = Number.isFinite(projectId)
  const user = useAuthStore((state) => state.user)
  const [memberUserId, setMemberUserId] = useState('')
  const [memberRole, setMemberRole] = useState('Member')
  const projectQuery = useQuery({ queryKey: ['projects', projectId], queryFn: () => getProject(projectId!), enabled: editing })
  const mutation = useMutation({
    mutationFn: (values: ProjectFormValues) => editing ? updateProject({ id: projectId!, input: values }) : createProject(values),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['projects'] })
      await queryClient.invalidateQueries({ queryKey: ['dashboard', 'summary'] })
      navigate('/projects/list')
    },
  })
  const deleteMutation = useMutation({
    mutationFn: () => deleteProject(projectId!),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['projects'] })
      await queryClient.invalidateQueries({ queryKey: ['dashboard', 'summary'] })
      navigate('/projects/list')
    },
  })
  const assignMutation = useMutation({
    mutationFn: () => assignProjectMember({ projectId: projectId!, userId: Number(memberUserId), role: memberRole }),
    onSuccess: async () => {
      setMemberUserId('')
      await queryClient.invalidateQueries({ queryKey: ['projects', projectId] })
    },
  })
  const removeMemberMutation = useMutation({
    mutationFn: (userId: number) => removeProjectMember({ projectId: projectId!, userId }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['projects', projectId] }),
  })

  const { register, reset, handleSubmit, formState: { errors } } = useForm<ProjectFormValues>({
    resolver: zodResolver(projectSchema),
    defaultValues: { name: '', description: '', startDate: '', endDate: '' },
  })

  useEffect(() => {
    if (projectQuery.data) {
      reset({
        name: projectQuery.data.name,
        description: projectQuery.data.description ?? '',
        startDate: projectQuery.data.startDate ?? '',
        endDate: projectQuery.data.endDate ?? '',
      })
    }
  }, [projectQuery.data, reset])

  if (editing && projectQuery.isPending) return <p className="text-muted-foreground">{t('common.loading')}</p>
  if (editing && projectQuery.isError) return <p className="text-sm text-red-600" role="alert">{t('projects.loadFailed')}</p>

  const allowedRoles = user?.role === 'Admin'
    ? ['Owner', 'Manager', 'Member', 'Viewer']
    : user?.role === 'Project Manager'
      ? ['Manager', 'Member']
      : ['Member']

  return (
    <section className="mx-auto max-w-3xl space-y-6">
      <header className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wide text-primary">{t('projects.eyebrow')}</p>
          <h1 className="text-3xl font-bold">{editing ? t('projects.edit') : t('projects.create')}</h1>
        </div>
        <Button variant="outline" onClick={() => navigate('/projects/list')}>{t('common.back')}</Button>
      </header>

      <form className="space-y-5 rounded-lg border border-border bg-card p-6" onSubmit={handleSubmit((values) => mutation.mutate(values))}>
        <div className="space-y-2">
          <Label htmlFor="name">{t('projects.fields.name')}</Label>
          <Input id="name" {...register('name')} />
          {errors.name && <p className="text-sm text-red-600">{t(errors.name.message ?? '')}</p>}
        </div>

        <div className="space-y-2">
          <Label htmlFor="description">{t('projects.fields.description')}</Label>
          <textarea id="description" rows={5} className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm" {...register('description')} />
          {errors.description && <p className="text-sm text-red-600">{t(errors.description.message ?? '')}</p>}
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2"><Label htmlFor="startDate">{t('projects.fields.startDate')}</Label><Input id="startDate" type="date" {...register('startDate')} /></div>
          <div className="space-y-2"><Label htmlFor="endDate">{t('projects.fields.endDate')}</Label><Input id="endDate" type="date" {...register('endDate')} />{errors.endDate && <p className="text-sm text-red-600">{t(errors.endDate.message ?? '')}</p>}</div>
        </div>

        {mutation.isError && <p className="text-sm text-red-600" role="alert">{getApiErrorMessage(mutation.error, t('projects.saveFailed'))}</p>}

        <div className="flex flex-wrap justify-between gap-3">
          {editing && projectQuery.data?.canDelete && <Button type="button" variant="outline" disabled={deleteMutation.isPending} onClick={() => window.confirm(t('projects.deleteConfirm')) && deleteMutation.mutate()}>{t('common.delete')}</Button>}
          <Button type="submit" disabled={mutation.isPending}>{mutation.isPending ? t('common.saving') : t('common.save')}</Button>
        </div>
      </form>

      {editing && projectQuery.data?.canEdit && (
        <section className="space-y-4 rounded-lg border border-border bg-card p-6">
          <h2 className="text-xl font-semibold">{t('projectMembers.title')}</h2>
          <div className="grid gap-3 sm:grid-cols-[1fr_12rem_auto]">
            <Input placeholder={t('projectMembers.userId')} value={memberUserId} onChange={(event) => setMemberUserId(event.target.value)} />
            <select className="h-10 rounded-md border border-border bg-background px-3 text-sm" value={memberRole} onChange={(event) => setMemberRole(event.target.value)}>{allowedRoles.map((role) => <option key={role}>{role}</option>)}</select>
            <Button type="button" disabled={!memberUserId || assignMutation.isPending} onClick={() => assignMutation.mutate()}>{t('projectMembers.assign')}</Button>
          </div>
          <ul className="divide-y divide-border">
            {projectQuery.data.members.map((member) => (
              <li key={member.userId} className="flex flex-wrap items-center justify-between gap-2 py-3 text-sm">
                <span><strong>{member.userName}</strong><span className="ml-2 text-muted-foreground">{member.email} · {member.role}</span></span>
                <Button type="button" variant="outline" disabled={removeMemberMutation.isPending} onClick={() => removeMemberMutation.mutate(member.userId)}>{t('common.remove')}</Button>
              </li>
            ))}
          </ul>
        </section>
      )}
    </section>
  )
}
