import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { assignProjectMember, listAssignments, listProjects, removeProjectMember } from '@/features/projects/api/project-api'
import { listUsers } from '@/features/users/api/user-api'
import { useAuthStore } from '@/store/use-auth-store'
import { getApiErrorMessage } from '@/utils/api-error'

const projectRoles = ['Owner', 'Manager', 'Member', 'Viewer'] as const
const nonAdminProjectRoles = ['Member', 'Viewer'] as const

function roleLabel(role: string | number, t: (key: string, options?: { defaultValue?: string }) => string) {
  const roleIndex = typeof role === 'number' || /^\d+$/.test(String(role)) ? Number(role) : -1
  const normalizedRole = roleIndex >= 0 ? projectRoles[roleIndex] : String(role)
  const key = normalizedRole.toLowerCase()
  return t(`projectAssignments.roles.${key}`, { defaultValue: normalizedRole })
}

export function ProjectAssignmentsPage() {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const currentUser = useAuthStore((state) => state.user)
  const isAdmin = currentUser?.role === 'Admin' || currentUser?.roles?.includes('Admin') === true
  const allowedRoles = isAdmin ? projectRoles : nonAdminProjectRoles

  const [rawSearch, setRawSearch] = useState('')
  const [search, setSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState('all')
  const [projectFilter, setProjectFilter] = useState('all')
  const [page, setPage] = useState(1)
  const [selectedProjectId, setSelectedProjectId] = useState<number>()
  const [selectedUserId, setSelectedUserId] = useState<number>()
  const [selectedRole, setSelectedRole] = useState<string>(allowedRoles[0] ?? 'Member')
  const pageSize = 10

  useEffect(() => {
    const timer = window.setTimeout(() => setSearch(rawSearch.trim()), 300)
    return () => window.clearTimeout(timer)
  }, [rawSearch])


  const projectsQuery = useQuery({
    queryKey: ['projects', 'assignment-options'],
    queryFn: () => listProjects({ start: 0, length: 200, sortColumn: 'Name', sortDirection: 'asc' }),
    staleTime: 5 * 60 * 1000,
  })
  const usersQuery = useQuery({
    queryKey: ['users', 'assignment-options'],
    queryFn: () => listUsers({ start: 0, length: 200, sortColumn: 'FirstName', sortDirection: 'asc' }),
    staleTime: 5 * 60 * 1000,
  })
  const assignmentsQuery = useQuery({
    queryKey: ['project-assignments', { search, roleFilter, projectFilter, page }],
    queryFn: () => listAssignments({
      search: search || undefined,
      role: roleFilter === 'all' ? undefined : roleFilter,
      projectId: projectFilter === 'all' ? undefined : Number(projectFilter),
      start: (page - 1) * pageSize,
      length: pageSize,
    }),
  })

  const projects = projectsQuery.data?.items ?? []
  const users = usersQuery.data?.items ?? []
  const assignments = assignmentsQuery.data?.items ?? []
  const totalPages = Math.max(assignmentsQuery.data?.totalPages ?? 1, 1)
  const effectiveProjectId = selectedProjectId ?? projects[0]?.id
  const effectiveUserId = selectedUserId ?? users[0]?.id
  const effectiveRole = allowedRoles.some((role) => role === selectedRole) ? selectedRole : (allowedRoles[0] ?? 'Member')


  const assignMutation = useMutation({
    mutationFn: () => assignProjectMember({ projectId: effectiveProjectId!, userId: effectiveUserId!, role: effectiveRole }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['project-assignments'] })
      await queryClient.invalidateQueries({ queryKey: ['projects'] })
      await queryClient.invalidateQueries({ queryKey: ['dashboard', 'summary'] })
      const nextUser = users.find((user) => user.id !== selectedUserId)
      if (nextUser) setSelectedUserId(nextUser.id)
    },
  })

  const removeMutation = useMutation({
    mutationFn: ({ projectId, userId }: { projectId: number; userId: number }) => removeProjectMember({ projectId, userId }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['project-assignments'] })
      await queryClient.invalidateQueries({ queryKey: ['projects'] })
      await queryClient.invalidateQueries({ queryKey: ['dashboard', 'summary'] })
    },
  })

  const setFilter = (setter: (value: string) => void, value: string) => {
    setPage(1)
    setter(value)
  }

  return (
    <section className="space-y-6">
      <header>
        <p className="text-sm font-semibold uppercase tracking-wide text-primary">{t('projectAssignments.eyebrow')}</p>
        <h1 className="text-3xl font-bold">{t('projectAssignments.title')}</h1>
      </header>

      <section className="space-y-5 rounded-lg border border-border bg-card p-5">
        <h2 className="text-xl font-semibold">{t('projectAssignments.formTitle')}</h2>
        <div className="grid gap-4 lg:grid-cols-3">
          <div className="space-y-2">
            <Label htmlFor="assignment-project">{t('projectAssignments.project')}</Label>
            <select id="assignment-project" className="h-10 w-full rounded-md border border-border bg-background px-3 text-sm" value={effectiveProjectId ?? ''} onChange={(event) => setSelectedProjectId(event.target.value ? Number(event.target.value) : undefined)} disabled={projectsQuery.isPending || projects.length === 0}>
              <option value="" disabled>{t('projectAssignments.selectProject')}</option>
              {projects.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}
            </select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="assignment-user">{t('projectAssignments.user')}</Label>
            <select id="assignment-user" className="h-10 w-full rounded-md border border-border bg-background px-3 text-sm" value={effectiveUserId ?? ''} onChange={(event) => setSelectedUserId(event.target.value ? Number(event.target.value) : undefined)} disabled={usersQuery.isPending || users.length === 0}>
              <option value="" disabled>{t('projectAssignments.selectUser')}</option>
              {users.map((user) => <option key={user.id} value={user.id}>{user.firstName} {user.lastName} ({user.email})</option>)}
            </select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="assignment-role">{t('projectAssignments.role')}</Label>
            <select id="assignment-role" className="h-10 w-full rounded-md border border-border bg-background px-3 text-sm" value={effectiveRole} onChange={(event) => setSelectedRole(event.target.value)}>
              {allowedRoles.map((role) => <option key={role} value={role}>{roleLabel(role, t)}</option>)}
            </select>
          </div>
        </div>
        {assignMutation.isError && <p className="text-sm text-red-600" role="alert">{getApiErrorMessage(assignMutation.error, t('projectAssignments.assignFailed'))}</p>}
        <Button type="button" disabled={!effectiveProjectId || !effectiveUserId || assignMutation.isPending} onClick={() => assignMutation.mutate()}>
          {assignMutation.isPending ? t('projectAssignments.assigning') : t('projectAssignments.assign')}
        </Button>
      </section>

      <div className="grid gap-3 rounded-lg border border-border bg-card p-4 lg:grid-cols-[1fr_15rem_12rem]">
        <Input type="search" placeholder={t('projectAssignments.search')} value={rawSearch} onChange={(event) => setRawSearch(event.target.value)} />
        <select className="h-10 rounded-md border border-border bg-background px-3 text-sm" value={projectFilter} onChange={(event) => setFilter(setProjectFilter, event.target.value)}>
          <option value="all">{t('projectAssignments.allProjects')}</option>
          {projects.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}
        </select>
        <select className="h-10 rounded-md border border-border bg-background px-3 text-sm" value={roleFilter} onChange={(event) => setFilter(setRoleFilter, event.target.value)}>
          <option value="all">{t('projectAssignments.allRoles')}</option>
          {projectRoles.map((role) => <option key={role} value={role}>{roleLabel(role, t)}</option>)}
        </select>
      </div>

      {(assignmentsQuery.isError || projectsQuery.isError || usersQuery.isError) && <p className="text-sm text-red-600" role="alert">{getApiErrorMessage(assignmentsQuery.error ?? projectsQuery.error ?? usersQuery.error, t('projectAssignments.loadFailed'))}</p>}
      {assignmentsQuery.isPending && <p className="text-muted-foreground">{t('common.loading')}</p>}
      {!assignmentsQuery.isPending && assignments.length === 0 && <p className="rounded-lg border border-border bg-card p-8 text-muted-foreground">{t('projectAssignments.empty')}</p>}

      {assignments.length > 0 && <div className="overflow-x-auto rounded-lg border border-border bg-card"><table className="w-full min-w-[700px] text-left text-sm"><thead className="border-b border-border text-muted-foreground"><tr><th className="p-3">{t('projectAssignments.project')}</th><th className="p-3">{t('projectAssignments.user')}</th><th className="p-3">{t('projectAssignments.email')}</th><th className="p-3">{t('projectAssignments.role')}</th><th className="p-3">{t('common.actions')}</th></tr></thead><tbody>{assignments.map((assignment) => <tr key={`${assignment.projectId}-${assignment.userId}`} className="border-b border-border last:border-0"><td className="p-3">{assignment.projectName}</td><td className="p-3">{assignment.userName}</td><td className="p-3">{assignment.email}</td><td className="p-3">{roleLabel(assignment.role, t)}</td><td className="p-3"><Button type="button" variant="outline" disabled={removeMutation.isPending} onClick={() => window.confirm(t('projectAssignments.removeConfirm', { user: assignment.userName, project: assignment.projectName })) && removeMutation.mutate({ projectId: assignment.projectId, userId: assignment.userId })}>{t('common.remove')}</Button></td></tr>)}</tbody></table></div>}
      {removeMutation.isError && <p className="text-sm text-red-600" role="alert">{getApiErrorMessage(removeMutation.error, t('projectAssignments.removeFailed'))}</p>}

      {totalPages > 1 && <div className="flex items-center justify-center gap-4"><Button variant="outline" disabled={page === 1} onClick={() => setPage((value) => value - 1)}>{t('common.previous')}</Button><span className="text-sm text-muted-foreground">{t('common.pageOf', { page, total: totalPages })}</span><Button variant="outline" disabled={page >= totalPages} onClick={() => setPage((value) => value + 1)}>{t('common.next')}</Button></div>}
    </section>
  )
}
