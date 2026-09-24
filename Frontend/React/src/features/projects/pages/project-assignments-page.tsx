import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { listAssignments } from '@/features/projects/api/project-api'

export function ProjectAssignmentsPage() {
  const { t } = useTranslation()
  const [search, setSearch] = useState('')
  const [role, setRole] = useState('all')
  const [page, setPage] = useState(1)
  const pageSize = 10
  const query = useQuery({ queryKey: ['project-assignments', { search, role, page }], queryFn: () => listAssignments({ search: search || undefined, role: role === 'all' ? undefined : role, start: (page - 1) * pageSize, length: pageSize }) })
  const assignments = query.data?.items ?? []
  const totalPages = Math.max(query.data?.totalPages ?? 1, 1)

  return (
    <section className="space-y-6">
      <header><p className="text-sm font-semibold uppercase tracking-wide text-primary">{t('projects.eyebrow')}</p><h1 className="text-3xl font-bold">{t('projects.assignments')}</h1></header>
      <div className="grid gap-3 rounded-lg border border-border bg-card p-4 md:grid-cols-3">
        <Input placeholder={t('common.search')} value={search} onChange={(event) => { setPage(1); setSearch(event.target.value) }} />
        <select className="h-10 rounded-md border border-border bg-background px-3 text-sm" value={role} onChange={(event) => { setPage(1); setRole(event.target.value) }}><option value="all">{t('common.all')}</option><option value="Owner">Owner</option><option value="Manager">Manager</option><option value="Member">Member</option><option value="Viewer">Viewer</option></select>
      </div>
      {query.isPending && <p className="text-muted-foreground">{t('common.loading')}</p>}
      <div className="overflow-x-auto rounded-lg border border-border bg-card"><table className="w-full text-left text-sm"><thead className="border-b border-border text-muted-foreground"><tr><th className="p-3">{t('projects.project')}</th><th className="p-3">{t('users.name')}</th><th className="p-3">{t('users.email')}</th><th className="p-3">{t('users.role')}</th></tr></thead><tbody>{assignments.map((item) => <tr key={`${item.projectId}-${item.userId}`} className="border-b border-border last:border-0"><td className="p-3">{item.projectName}</td><td className="p-3">{item.userName}</td><td className="p-3">{item.email}</td><td className="p-3">{item.role}</td></tr>)}</tbody></table></div>
      {totalPages > 1 && <div className="flex items-center justify-center gap-4"><Button variant="outline" disabled={page === 1} onClick={() => setPage((value) => value - 1)}>{t('common.previous')}</Button><span className="text-sm text-muted-foreground">{t('common.pageOf', { page, total: totalPages })}</span><Button variant="outline" disabled={page >= totalPages} onClick={() => setPage((value) => value + 1)}>{t('common.next')}</Button></div>}
    </section>
  )
}
