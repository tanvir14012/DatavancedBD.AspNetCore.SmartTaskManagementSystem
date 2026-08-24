import { HttpClient } from '@angular/common/http';
import { computed, Injectable, signal } from '@angular/core';
import { Observable, finalize, map, shareReplay, tap } from 'rxjs';
import { environment } from '../../../environments/environment';
import { MenuApiResponse, MenuItem, MenuResponse } from '../models/menu-item.model';

@Injectable({ providedIn: 'root' })
export class MenuService {
  private static readonly MENU_STORAGE_KEY = 'stms.menus';
  private static readonly CURRENT_ROUTE_STORAGE_KEY = 'stms.current-route';
  private static readonly DEFAULT_ROUTE = '/dashboard';

  readonly topBarMenus = signal<MenuItem[]>([]);
  readonly currentRoute = signal<string>(this.readStoredCurrentRoute());
  readonly isLoading = signal(false);
  readonly sideBarMenus = computed<MenuItem[]>(() => {
    const topBar = this.topBarMenus();
    const route = this.currentRoute();

    if (!topBar.length) {
      return [];
    }

    const selectedTopBar =
      topBar.find((item) => this.matchesRoute(item.route, route) || this.hasMatchingChildRoute(item, route)) ??
      topBar.find((item) => this.matchesRoute(item.route, MenuService.DEFAULT_ROUTE)) ??
      topBar[0];

    if (!selectedTopBar) {
      return [];
    }

    const children = (selectedTopBar.children ?? []).filter((child) => child.route && child.name);
    return children.length > 0 ? children : [selectedTopBar];
  });

  private menuRequest$?: Observable<MenuResponse>;

  constructor(private readonly http: HttpClient) {
    const cachedMenus = this.readStoredMenus();
    this.topBarMenus.set(cachedMenus.topBar);
    this.currentRoute.set(this.readStoredCurrentRoute());
  }

  loadMenus(): Observable<MenuResponse> {
    if (!this.menuRequest$) {
      this.isLoading.set(true);
      this.menuRequest$ = this.http
        .get<MenuApiResponse>(`${environment.apiBaseUrl}/menus/`)
        .pipe(
          map((response) => this.normalizeMenuResponse(response)),
          tap((response) => this.persistMenus(response)),
          tap((response) => {
            this.topBarMenus.set(response.topBar.length ? response.topBar : this.readStoredMenus().topBar);
          }),
          finalize(() => this.isLoading.set(false)),
          shareReplay({ bufferSize: 1, refCount: true }),
        );
    }

    return this.menuRequest$;
  }

  ensureMenusLoaded(): void {
    if (this.topBarMenus().length > 0 || this.isLoading()) {
      return;
    }

    this.loadMenus().subscribe({
      error: () => {
        const cachedMenus = this.readStoredMenus();
        if (cachedMenus.topBar.length) {
          this.topBarMenus.set(cachedMenus.topBar);
        }
      },
    });
  }

  refreshMenus(): Observable<MenuResponse> {
    this.invalidateCache();
    return this.loadMenus();
  }

  clearMenus(): void {
    this.invalidateCache();
    this.isLoading.set(false);
    localStorage.removeItem(MenuService.MENU_STORAGE_KEY);
  }

  setCurrentRoute(route: string): void {
    const normalizedRoute = this.normalizeRoute(route || MenuService.DEFAULT_ROUTE);
    this.currentRoute.set(normalizedRoute);
    localStorage.setItem(MenuService.CURRENT_ROUTE_STORAGE_KEY, normalizedRoute);
  }

  invalidateCache(): void {
    this.menuRequest$ = undefined;
    this.topBarMenus.set([]);
    this.currentRoute.set(MenuService.DEFAULT_ROUTE);
    this.isLoading.set(false);
    localStorage.setItem(MenuService.CURRENT_ROUTE_STORAGE_KEY, MenuService.DEFAULT_ROUTE);
  }

  private normalizeMenuResponse(response: Partial<MenuApiResponse> | null | undefined): MenuResponse {
    const topBar = this.filterVisibleMenuItems(this.normalizeMenuItems(response?.menus ?? response?.topBar ?? []));
    const sideBar = this.filterVisibleMenuItems(
      this.normalizeMenuItems(
        response?.sideBar ?? topBar.flatMap((item) => (Array.isArray(item.children) && item.children.length > 0 ? item.children : [item])),
      ),
    );

    return {
      menus: topBar,
      topBar,
      sideBar,
    };
  }

  private normalizeMenuItems(items: unknown): MenuItem[] {
    if (!Array.isArray(items)) {
      return [];
    }

    return items.map((item) => {
      const menuItem = item as Partial<MenuItem>;
      return {
        ...menuItem,
        id: menuItem.id ?? 0,
        name: menuItem.name ?? '',
        route: menuItem.route ?? '',
        icon: menuItem.icon ?? '',
        displayOrder: menuItem.displayOrder ?? 0,
        parentId: menuItem.parentId ?? null,
        type: menuItem.type ?? 'TopBar',
        children: this.normalizeMenuItems(menuItem.children ?? []),
      } satisfies MenuItem;
    });
  }

  private filterVisibleMenuItems(items: MenuItem[]): MenuItem[] {
    const userRole = this.readStoredUserRole();
    const canAccessBoard = userRole === 'Admin' || userRole === 'Project Manager';
    const canManageProjects = userRole === 'Admin' || userRole === 'Project Manager';

    return items
      .filter((item) => {
        const route = this.normalizeRoute(item.route);

        if (route === '/tasks/board' && !canAccessBoard) {
          return false;
        }

        if ((route === '/projects/new' || route === '/projects/assign') && !canManageProjects) {
          return false;
        }

        return true;
      })
      .map((item) => ({
        ...item,
        children: this.filterVisibleMenuItems(item.children ?? []),
      }));
  }

  private readStoredUserRole(): string {
    try {
      const cachedUser = localStorage.getItem('stms.user');
      if (!cachedUser) {
        return '';
      }

      const parsed = JSON.parse(cachedUser) as { role?: string };
      return parsed.role ?? '';
    } catch {
      return '';
    }
  }

  private matchesRoute(menuRoute: string, currentRoute: string): boolean {
    const normalizedMenuRoute = this.normalizeRoute(menuRoute);
    const normalizedCurrentRoute = this.normalizeRoute(currentRoute);

    return normalizedCurrentRoute === normalizedMenuRoute || normalizedCurrentRoute.startsWith(`${normalizedMenuRoute}/`);
  }

  private hasMatchingChildRoute(item: MenuItem, currentRoute: string): boolean {
    return (item.children ?? []).some((child) => this.matchesRoute(child.route, currentRoute));
  }

  private normalizeRoute(route: string): string {
    const normalized = route.split('?')[0].split('#')[0].trim();
    return normalized || MenuService.DEFAULT_ROUTE;
  }

  private persistMenus(menus: MenuResponse): void {
    localStorage.setItem(MenuService.MENU_STORAGE_KEY, JSON.stringify(menus));
  }

  private readStoredMenus(): MenuResponse {
    try {
      const cached = localStorage.getItem(MenuService.MENU_STORAGE_KEY);
      if (!cached) {
        return { menus: [], topBar: [], sideBar: [] };
      }

      const parsed = JSON.parse(cached) as Partial<MenuApiResponse>;
      return this.normalizeMenuResponse(parsed);
    } catch {
      return { menus: [], topBar: [], sideBar: [] };
    }
  }

  private readStoredCurrentRoute(): string {
    try {
      const cachedRoute = localStorage.getItem(MenuService.CURRENT_ROUTE_STORAGE_KEY);
      if (cachedRoute) {
        return this.normalizeRoute(cachedRoute);
      }
    } catch {
      // ignore storage access issues and fall back to the browser URL.
    }

    return this.normalizeRoute(typeof window !== 'undefined' ? window.location.pathname : MenuService.DEFAULT_ROUTE);
  }
}
