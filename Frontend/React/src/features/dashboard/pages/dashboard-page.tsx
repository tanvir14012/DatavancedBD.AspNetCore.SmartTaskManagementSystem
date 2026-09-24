import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import { getDashboardSummary } from '@/features/dashboard/api/dashboard-api'

function label(value: string) {
  return value.replace(/([a-z0-9])([A-Z])/g, '$1 $2').replace(/_/g, ' ')
}

function formatDate(value?: string | null) {
  if (!value) return '—'
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? '—' : new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(date)
}

export function DashboardPage() {
  const { t } = useTranslation()
  const query = useQuery({ queryKey: ['dashboard', 'summary'], queryFn: () => getDashboardSummary() })
  const summary = query.data
  const completionRate = summary?.totalTasks ? Math.round((summary.completedTasks / summary.totalTasks) * 100) : 0

  return (
    <section className="space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wide text-primary">{t('dashboard.eyebrow')}</p>
          <h1 className="text-3xl font-bold">{t('dashboard.title')}</h1>
        </div>
        <Button variant="outline" disabled={query.isFetching} onClick={() => query.refetch()}>
          {query.isFetching ? t('common.refreshing') : t('common.refresh')}
        </Button>
      </header>

      {query.isPending && <p className="text-muted-foreground">{t('common.loading')}</p>}
      {query.isError && <p className="text-sm text-red-600" role="alert">{t('dashboard.loadFailed')}</p>}

      {summary && (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {[
              ['dashboard.totalProjects', summary.totalProjects],
              ['dashboard.totalTasks', summary.totalTasks],
              ['dashboard.pending', summary.pendingTasks],
              ['dashboard.completed', summary.completedTasks],
            ].map(([key, value]) => (
              <article key={String(key)} className="rounded-lg border border-border bg-card p-5">
                <p className="text-sm text-muted-foreground">{t(String(key))}</p>
                <strong className="mt-2 block text-3xl">{value}</strong>
              </article>
            ))}
          </div>

          <div className="grid gap-6 lg:grid-cols-3">
            <article className="rounded-lg border border-border bg-card p-5">
              <h2 className="font-semibold">{t('dashboard.completionRate')}</h2>
              <div className="mt-5 flex items-center gap-4">
                <div className="flex h-24 w-24 items-center justify-center rounded-full border-8 border-primary text-xl font-bold">
                  {completionRate}%
                </div>
                <p className="text-sm text-muted-foreground">{summary.completedTasks} / {summary.totalTasks}</p>
              </div>
            </article>

            {[
              ['dashboard.statusBreakdown', summary.statusBreakdown],
              ['dashboard.priorityBreakdown', summary.priorityBreakdown],
            ].map(([title, items]) => (
              <article key={String(title)} className="rounded-lg border border-border bg-card p-5">
                <h2 className="font-semibold">{t(String(title))}</h2>
                <ul className="mt-4 space-y-3">
                  {(items as { key: string; value: number }[]).map((item) => (
                    <li key={item.key} className="flex justify-between text-sm">
                      <span className="text-muted-foreground">{label(item.key)}</span>
                      <strong>{item.value}</strong>
                    </li>
                  ))}
                </ul>
              </article>
            ))}
          </div>

          <article className="rounded-lg border border-border bg-card p-5">
            <h2 className="font-semibold">{t('dashboard.upcoming')}</h2>
            {summary.urgentTasks.length === 0 ? (
              <p className="mt-3 text-sm text-muted-foreground">{t('dashboard.noUrgentTasks')}</p>
            ) : (
              <ul className="mt-4 divide-y divide-border">
                {summary.urgentTasks.map((task) => (
                  <li key={task.id} className="flex flex-wrap justify-between gap-2 py-3 text-sm">
                    <span>{task.title} · {label(task.status)} · {label(task.priority)}</span>
                    <span className="text-muted-foreground">{formatDate(task.dueDate)}</span>
                  </li>
                ))}
              </ul>
            )}
          </article>
        </>
      )}
    </section>
  )
}
