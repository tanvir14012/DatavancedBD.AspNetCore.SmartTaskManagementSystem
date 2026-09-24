import { useCallback, useEffect, useState } from 'react'
import { Link, NavLink, Outlet, useLocation } from 'react-router'

import { useSyncTheme } from '@/hooks/use-sync-theme'
import { LanguageSwitcher } from '@/components/shared/language-switcher'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { Button } from '@/components/ui/button'
import { useLogoutMutation } from '@/features/auth/hooks/use-auth-mutations'
import { useMenus } from '@/features/navigation/hooks/use-menus'
import type { MenuItem } from '@/features/navigation/api/menu-api'
import { useAuthStore } from '@/store/use-auth-store'
import { useThemeStore, type Palette, type ThemeMode } from '@/store/use-theme-store'

function readExpandedMenuIds(): number[] {
  try {
    const saved = localStorage.getItem('stms-expanded-menus')

    if (!saved) {
      return []
    }

    const parsed: unknown = JSON.parse(saved)

    return Array.isArray(parsed) && parsed.every((id) => typeof id === 'number') ? parsed : []
  } catch {
    return []
  }
}

export function AppShell() {
  useSyncTheme()

  const [mobileOpen, setMobileOpen] = useState(false)
  const [expandedMenuIds, setExpandedMenuIds] = useState<number[]>(readExpandedMenuIds)

  const mode = useThemeStore((state) => state.mode)
  const palette = useThemeStore((state) => state.palette)
  const setMode = useThemeStore((state) => state.setMode)
  const setPalette = useThemeStore((state) => state.setPalette)

  const location = useLocation()
  const { data: menus = [], isPending, isError } = useMenus()

  const user = useAuthStore((state) => state.user)
  const logoutMutation = useLogoutMutation()

  const isRouteActive = useCallback(
    (route: string) =>
      location.pathname === route || (route !== '/' && location.pathname.startsWith(`${route}/`)),
    [location.pathname],
  )

  const setExpanded = useCallback((menuId: number, expanded: boolean) => {
    setExpandedMenuIds((current) => {
      const next = expanded
        ? [...new Set([...current, menuId])]
        : current.filter((id) => id !== menuId)

      localStorage.setItem('stms-expanded-menus', JSON.stringify(next))

      return next
    })
  }, [])

  const getMenuRoute = (menu: MenuItem) => menu.children[0]?.route ?? menu.route

  useEffect(() => {
    menus.forEach((menu) => {
      if (isRouteActive(menu.route)) {
        setExpanded(menu.id, true)
      }
    })
  }, [menus, isRouteActive, setExpanded])

  const initials = `${user?.firstName?.[0] ?? ''}${user?.lastName?.[0] ?? ''}`.toUpperCase() || 'U'

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-40 border-b border-border bg-card">
        <div className="flex h-16 items-center justify-between px-4 lg:px-6">
          <div className="flex min-w-0 items-center gap-4">
            <button
              type="button"
              aria-label="Open navigation"
              className="rounded-md border border-border px-3 py-2 lg:hidden"
              onClick={() => setMobileOpen(true)}
            >
              ☰
            </button>

            <Link to="/dashboard" className="shrink-0 font-bold">
              STMS
            </Link>

            <nav className="hidden items-center gap-2 lg:flex">
              {menus.map((menu) => (
                <NavLink
                  key={menu.id}
                  to={getMenuRoute(menu)}
                  className={[
                    'rounded-md px-3 py-2 text-sm transition-colors',
                    isRouteActive(menu.route)
                      ? 'bg-primary text-primary-foreground'
                      : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                  ].join(' ')}
                >
                  {menu.name}
                </NavLink>
              ))}
            </nav>
          </div>

          <div className="flex shrink-0 items-center gap-3">
            <LanguageSwitcher />

            <details className="relative">
              <summary className="flex cursor-pointer list-none items-center gap-2 [&::-webkit-details-marker]:hidden">
                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">
                  {initials}
                </span>

                <span className="hidden max-w-48 text-left lg:block">
                  <span className="block truncate text-sm font-medium">
                    {user?.firstName} {user?.lastName}
                  </span>

                  <span className="block truncate text-xs text-muted-foreground">
                    {user?.email}
                  </span>
                </span>
              </summary>

              <div className="absolute right-0 mt-2 w-64 rounded-md border border-border bg-card p-3 shadow-lg">
                <div className="mb-3 flex items-center justify-between border-b border-border pb-3">
                  <span className="text-sm font-semibold">Account</span>

                  <button
                    type="button"
                    aria-label="Close user menu"
                    className="rounded-md px-2 py-1 text-lg hover:bg-muted"
                    onClick={(event) => {
                      event.currentTarget.closest('details')?.removeAttribute('open')
                    }}
                  >
                    ×
                  </button>
                </div>

                <div className="mb-3 border-b border-border pb-3">
                  <p className="font-medium">
                    {user?.firstName} {user?.lastName}
                  </p>

                  <p className="truncate text-sm text-muted-foreground">{user?.email}</p>
                </div>

                <div className="mb-3 border-b border-border pb-3">
                  <p className="mb-2 text-xs font-semibold uppercase text-muted-foreground">
                    Appearance
                  </p>

                  <div className="grid grid-cols-3 gap-1">
                    {(['light', 'dark', 'system'] as ThemeMode[]).map((themeMode) => (
                      <button
                        key={themeMode}
                        type="button"
                        className={[
                          'rounded-md px-2 py-1 text-xs capitalize',
                          mode === themeMode
                            ? 'bg-primary text-primary-foreground'
                            : 'hover:bg-muted',
                        ].join(' ')}
                        onClick={() => setMode(themeMode)}
                      >
                        {themeMode}
                      </button>
                    ))}
                  </div>

                  <select
                    aria-label="Color palette"
                    value={palette}
                    onChange={(event) => setPalette(event.target.value as Palette)}
                    className="mt-2 h-8 w-full rounded-md border border-border bg-background px-2 text-xs"
                  >
                    <option value="blue">Blue palette</option>
                    <option value="violet">Violet palette</option>
                    <option value="green">Green palette</option>
                  </select>
                </div>

                <Button
                  type="button"
                  variant="outline"
                  className="w-full"
                  disabled={logoutMutation.isPending}
                  onClick={() => logoutMutation.mutate()}
                >
                  {logoutMutation.isPending ? 'Signing out...' : 'Sign out'}
                </Button>
              </div>
            </details>
          </div>
        </div>
      </header>

      <div className="flex min-h-[calc(100vh-4rem)]">
        {mobileOpen && (
          <button
            type="button"
            aria-label="Close navigation"
            className="fixed inset-0 z-40 bg-black/40 lg:hidden"
            onClick={() => setMobileOpen(false)}
          />
        )}

        <aside
          className={[
            'fixed inset-y-16 left-0 z-50 w-72 overflow-y-auto border-r border-border bg-card p-4',
            'transition-transform lg:sticky lg:top-16 lg:z-auto lg:h-[calc(100vh-4rem)] lg:translate-x-0',
            mobileOpen ? 'translate-x-0' : '-translate-x-full',
          ].join(' ')}
        >
          <div className="mb-4 flex items-center justify-between lg:hidden">
            <span className="font-semibold">Navigation</span>

            <button
              type="button"
              aria-label="Close navigation"
              className="rounded-md border border-border px-3 py-1"
              onClick={() => setMobileOpen(false)}
            >
              ×
            </button>
          </div>

          {isPending && <p className="text-sm text-muted-foreground">Loading navigation...</p>}

          {isError && (
            <p className="text-sm text-red-600" role="alert">
              Navigation could not be loaded.
            </p>
          )}

          <nav className="space-y-3">
            {menus.map((menu) => {
              const menuIsActive = isRouteActive(menu.route)

              if (menu.children.length === 0) {
                return (
                  <NavLink
                    key={menu.id}
                    to={menu.route}
                    onClick={() => setMobileOpen(false)}
                    className={[
                      'block rounded-md px-3 py-2 text-sm transition-colors',
                      menuIsActive
                        ? 'bg-primary text-primary-foreground'
                        : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                    ].join(' ')}
                  >
                    {menu.name}
                  </NavLink>
                )
              }

              return (
                <Collapsible
                  key={menu.id}
                  open={expandedMenuIds.includes(menu.id)}
                  onOpenChange={(open) => setExpanded(menu.id, open)}
                >
                  <CollapsibleTrigger asChild>
                    <button
                      type="button"
                      className={[
                        'group flex w-full items-center justify-between rounded-md px-3 py-2 text-left text-xs font-semibold uppercase transition-colors',
                        menuIsActive
                          ? 'bg-primary/10 text-primary'
                          : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                      ].join(' ')}
                    >
                      <span>{menu.name}</span>

                      <span
                        aria-hidden="true"
                        className="transition-transform duration-200 group-data-[state=open]:rotate-180"
                      >
                        ⌄
                      </span>
                    </button>
                  </CollapsibleTrigger>

                  <CollapsibleContent className="mt-1 space-y-1">
                    {menu.children.map((child) => (
                      <NavLink
                        key={child.id}
                        to={child.route}
                        onClick={() => setMobileOpen(false)}
                        className={({ isActive }) =>
                          [
                            'block rounded-md px-3 py-2 text-sm transition-colors',
                            isActive
                              ? 'bg-primary text-primary-foreground'
                              : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                          ].join(' ')
                        }
                      >
                        {child.name}
                      </NavLink>
                    ))}
                  </CollapsibleContent>
                </Collapsible>
              )
            })}
          </nav>
        </aside>

        <main className="min-w-0 flex-1 p-4 lg:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
