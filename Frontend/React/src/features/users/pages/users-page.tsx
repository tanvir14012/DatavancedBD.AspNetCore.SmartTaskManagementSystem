import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { createUser, deleteUser, listUsers, updateUser, type UserInput } from '@/features/users/api/user-api'
import { useAuthStore } from '@/store/use-auth-store'
import { getApiErrorMessage } from '@/utils/api-error'

const emptyForm: UserInput = { firstName: '', lastName: '', email: '', password: '', role: 'Team Member' }

export function UsersPage() {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const currentUser = useAuthStore((state) => state.user)
  const isAdmin = currentUser?.role === 'Admin' || currentUser?.roles.includes('Admin')
  const [search, setSearch] = useState('')
  const [role, setRole] = useState('all')
  const [status, setStatus] = useState('all')
  const [sortColumn, setSortColumn] = useState('CreatedAt')
  const [sortDirection, setSortDirection] = useState('desc')
  const [page, setPage] = useState(1)
  const [formOpen, setFormOpen] = useState(false)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [form, setForm] = useState<UserInput>(emptyForm)
  const [error, setError] = useState('')
  const pageSize = 10
  const query = useQuery({ queryKey: ['users', { search, role, status, sortColumn, sortDirection, page }], queryFn: () => listUsers({ search: search || undefined, role: role === 'all' ? undefined : role, status: status === 'all' ? undefined : status, sortColumn, sortDirection, start: (page - 1) * pageSize, length: pageSize }) })
  const mutation = useMutation({ mutationFn: () => editingId ? updateUser({ id: editingId, input: { ...form, password: undefined } }) : createUser(form), onSuccess: async () => { setFormOpen(false); setEditingId(null); await queryClient.invalidateQueries({ queryKey: ['users'] }) }, onError: (cause) => setError(getApiErrorMessage(cause, t('users.saveFailed'))) })
  const deleteMutation = useMutation({ mutationFn: deleteUser, onSuccess: () => queryClient.invalidateQueries({ queryKey: ['users'] }) })

  const users = query.data?.items ?? []
  const totalPages = Math.max(query.data?.totalPages ?? 1, 1)
  const openCreate = () => { setEditingId(null); setForm(emptyForm); setError(''); setFormOpen(true) }
  const openEdit = (user: typeof users[number]) => { setEditingId(user.id); setForm({ firstName: user.firstName, lastName: user.lastName, email: user.email, role: user.role }); setError(''); setFormOpen(true) }
  const updateField = (key: keyof UserInput, value: string) => setForm((current) => ({ ...current, [key]: value }))

  return (
    <section className="space-y-6">
      <header className="flex items-center justify-between gap-3"><div><p className="text-sm font-semibold uppercase tracking-wide text-primary">{t('users.eyebrow')}</p><h1 className="text-3xl font-bold">{t('users.title')}</h1></div>{isAdmin && <Button onClick={openCreate}>{t('users.add')}</Button>}</header>
      <div className="grid gap-3 rounded-lg border border-border bg-card p-4 md:grid-cols-5"><Input placeholder={t('common.search')} value={search} onChange={(event) => { setPage(1); setSearch(event.target.value) }} /><select className="h-10 rounded-md border border-border bg-background px-3 text-sm" value={role} onChange={(event) => { setPage(1); setRole(event.target.value) }}><option value="all">{t('common.all')}</option><option value="Admin">Admin</option><option value="Project Manager">Project Manager</option><option value="Team Member">Team Member</option></select><select className="h-10 rounded-md border border-border bg-background px-3 text-sm" value={status} onChange={(event) => { setPage(1); setStatus(event.target.value) }}><option value="all">{t('common.all')}</option><option value="active">{t('users.active')}</option><option value="inactive">{t('users.inactive')}</option></select><select className="h-10 rounded-md border border-border bg-background px-3 text-sm" value={sortColumn} onChange={(event) => { setPage(1); setSortColumn(event.target.value) }}><option value="FirstName">{t('users.firstName')}</option><option value="LastName">{t('users.lastName')}</option><option value="Email">{t('users.email')}</option><option value="CreatedAt">{t('users.created')}</option></select><select className="h-10 rounded-md border border-border bg-background px-3 text-sm" value={sortDirection} onChange={(event) => { setPage(1); setSortDirection(event.target.value) }}><option value="asc">{t('common.ascending')}</option><option value="desc">{t('common.descending')}</option></select></div>
      {formOpen && isAdmin && <form className="grid gap-4 rounded-lg border border-border bg-card p-5 md:grid-cols-2" onSubmit={(event) => { event.preventDefault(); setError(''); mutation.mutate() }}><h2 className="md:col-span-2 text-xl font-semibold">{editingId ? t('users.edit') : t('users.add')}</h2>{(['firstName', 'lastName', 'email', ...(editingId ? [] : ['password'])] as (keyof UserInput)[]).map((field) => <div key={field} className="space-y-2"><label className="text-sm font-medium" htmlFor={`user-${field}`}>{t(`users.${field}`)}</label><Input id={`user-${field}`} type={field === 'password' ? 'password' : field === 'email' ? 'email' : 'text'} value={String(form[field] ?? '')} onChange={(event) => updateField(field, event.target.value)} required={field !== 'password' || !editingId} /></div>)}<div className="space-y-2"><label className="text-sm font-medium" htmlFor="user-role">{t('users.role')}</label><select id="user-role" className="h-10 w-full rounded-md border border-border bg-background px-3 text-sm" value={form.role} onChange={(event) => updateField('role', event.target.value)}><option>Admin</option><option>Project Manager</option><option>Team Member</option></select></div>{error && <p className="md:col-span-2 text-sm text-red-600" role="alert">{error}</p>}<div className="flex gap-2 md:col-span-2"><Button type="submit" disabled={mutation.isPending}>{mutation.isPending ? t('common.saving') : t('common.save')}</Button><Button type="button" variant="outline" onClick={() => setFormOpen(false)}>{t('common.cancel')}</Button></div></form>}
      {query.isPending && <p className="text-muted-foreground">{t('common.loading')}</p>}
      <div className="overflow-x-auto rounded-lg border border-border bg-card"><table className="w-full text-left text-sm"><thead className="border-b border-border text-muted-foreground"><tr><th className="p-3">{t('users.name')}</th><th className="p-3">{t('users.email')}</th><th className="p-3">{t('users.role')}</th><th className="p-3">{t('users.status')}</th>{isAdmin && <th className="p-3">{t('common.actions')}</th>}</tr></thead><tbody>{users.map((user) => <tr key={user.id} className="border-b border-border last:border-0"><td className="p-3">{user.firstName} {user.lastName}</td><td className="p-3">{user.email}</td><td className="p-3">{user.role}</td><td className="p-3">{user.isActive ? t('users.active') : t('users.inactive')}</td>{isAdmin && <td className="flex gap-2 p-3"><Button variant="outline" onClick={() => openEdit(user)}>{t('common.edit')}</Button><Button variant="outline" onClick={() => window.confirm(t('users.deleteConfirm')) && deleteMutation.mutate(user.id)}>{t('common.delete')}</Button></td>}</tr>)}</tbody></table></div>
      {totalPages > 1 && <div className="flex items-center justify-center gap-4"><Button variant="outline" disabled={page === 1} onClick={() => setPage((value) => value - 1)}>{t('common.previous')}</Button><span className="text-sm text-muted-foreground">{t('common.pageOf', { page, total: totalPages })}</span><Button variant="outline" disabled={page >= totalPages} onClick={() => setPage((value) => value + 1)}>{t('common.next')}</Button></div>}
    </section>
  )
}
