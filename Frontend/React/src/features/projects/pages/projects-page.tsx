import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useNavigate } from 'react-router'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { listProjects } from '@/features/projects/api/project-api'
import { useAuthStore } from '@/store/use-auth-store'

export function ProjectsPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const user = useAuthStore((state) => state.user)
  const canCreate = user?.role === 'Admin' || user?.role === 'Project Manager'
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('all')
  const [sortColumn, setSortColumn] = useState('CreatedAt')
  const [sortDirection, setSortDirection] = useState('desc')
  const [page, setPage] = useState(1)
  const pageSize = 10

  const query = useQuery({
    queryKey: ['projects', { search, status, sortColumn, sortDirection, page }],
    queryFn: () =>
      listProjects({
        search: search.trim() || undefined,
        status: status === 'all' ? undefined : status,
        sortColumn,
        sortDirection,
        start: (page - 1) * pageSize,
        length: pageSize,
      }),
  })

  const projects = query.data?.items ?? []
  const totalPages = Math.max(query.data?.totalPages ?? 1, 1)

  return (
    <section className="space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wide text-primary">{t('projects.eyebrow')}</p>
          <h1 className="text-3xl font-bold">{t('projects.title')}</h1>
        </div>
        {canCreate && <Button onClick={() => navigate('/projects/new')}>{t('projects.new')}</Button>}
      </header>

      <div className="grid gap-3 rounded-lg border border-border bg-card p-4 md:grid-cols-4">
        <Input placeholder={t('projects.search')} value={search} onChange={(event) => { setPage(1); setSearch(event.target.value) }} />
        <select className="h-10 rounded-md border border-border bg-background px-3 text-sm" value={status} onChange={(event) => { setPage(1); setStatus(event.target.value) }}>
          <option value="all">{t('common.all')}</option>
          <option value="active">{t('projects.status.active')}</option>
          <option value="planned">{t('projects.status.planned')}</option>
          <option value="completed">{t('projects.status.completed')}</option>
        </select>
        <select className="h-10 rounded-md border border-border bg-background px-3 text-sm" value={sortColumn} onChange={(event) => { setPage(1); setSortColumn(event.target.value) }}>
          <option value="Name">{t('projects.sort.name')}</option>
          <option value="CreatedAt">{t('projects.sort.created')}</option>
          <option value="UpdatedAt">{t('projects.sort.updated')}</option>
        </select>
        <select className="h-10 rounded-md border border-border bg-background px-3 text-sm" value={sortDirection} onChange={(event) => { setPage(1); setSortDirection(event.target.value) }}>
          <option value="asc">{t('common.ascending')}</option>
          <option value="desc">{t('common.descending')}</option>
        </select>
      </div>

      {query.isPending && <p className="text-muted-foreground">{t('common.loading')}</p>}
      {query.isError && <p className="text-sm text-red-600" role="alert">{t('projects.loadFailed')}</p>}

      {!query.isPending && projects.length === 0 && <p className="rounded-lg border border-border bg-card p-8 text-muted-foreground">{t('projects.empty')}</p>}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {projects.map((project) => (
          <article key={project.id} className="flex flex-col rounded-lg border border-border bg-card p-5">
            <div className="flex items-center justify-between gap-2 text-sm text-muted-foreground">
              <span className="rounded-full bg-muted px-2 py-1">{project.status || t('projects.status.active')}</span>
              <span>{project.role || t('projects.member')}</span>
            </div>
            <h2 className="mt-4 text-xl font-semibold">{project.name}</h2>
            <p className="mt-2 line-clamp-3 text-sm text-muted-foreground">{project.description || t('projects.noDescription')}</p>
            <div className="mt-4 flex justify-between text-xs text-muted-foreground">
              <span>{t('projects.tasks')}: {project.taskCount}</span>
              <span>{project.updatedAt ? new Date(project.updatedAt).toLocaleDateString() : t('projects.recently')}</span>
            </div>
            <div className="mt-5 flex gap-2">
              <Link className="rounded-md border border-border px-3 py-2 text-sm hover:bg-muted" to={`/projects/${project.id}`}>
                {t('common.view')}
              </Link>
              {project.canEdit && <Link className="rounded-md border border-border px-3 py-2 text-sm hover:bg-muted" to={`/projects/${project.id}/edit`}>{t('common.edit')}</Link>}
            </div>
          </article>
        ))}
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-4">
          <Button variant="outline" disabled={page === 1} onClick={() => setPage((current) => current - 1)}>{t('common.previous')}</Button>
          <span className="text-sm text-muted-foreground">{t('common.pageOf', { page, total: totalPages })}</span>
          <Button variant="outline" disabled={page >= totalPages} onClick={() => setPage((current) => current + 1)}>{t('common.next')}</Button>
        </div>
      )}
    </section>
  )
}
