import { computed, inject, Injectable, signal } from '@angular/core';
import { AuthService } from './auth.service';
import { MenuApiResponse, MenuItem, MenuResponse } from '../models/menu-item.model';

@Injectable({ providedIn: 'root' })
export class MenuService {
  static readonly MENU_STORAGE_KEY = 'stms.menus';
  private static readonly CURRENT_ROUTE_STORAGE_KEY = 'stms.current-route';
  private static readonly DEFAULT_ROUTE = '/dashboard';

  private readonly authService = inject(AuthService);
  private readonly topBarMenusState = signal<MenuItem[]>(this.readStoredMenus().topBar);

  readonly topBarMenus = this.topBarMenusState.asReadonly();
  readonly currentRoute = signal<string>(this.readStoredCurrentRoute());

  readonly sideBarMenus = computed<MenuItem[]>(() => {
    const topBar = this.topBarMenusState();
    const route = this.currentRoute();

    if (topBar.length === 0) {
      return [];
    }

    const selectedTopBar = topBar.find(
      (item) => this.matchesRoute(item.route, route) || this.hasMatchingChildRoute(item, route),
    );

    if (selectedTopBar) {
      const children = selectedTopBar.children ?? [];
      return children.length > 0 ? children : [selectedTopBar];
    }

    const fallbackItem = topBar[0];
    if (!fallbackItem) return [];

    const fallbackChildren = fallbackItem.children ?? [];
    return fallbackChildren.length > 0 ? fallbackChildren : [fallbackItem];
  });

  setMenuResponse(response: Partial<MenuApiResponse> | null | undefined): void {
    const normalized = this.normalizeMenuResponse(response);
    this.topBarMenusState.set(normalized.topBar);
    this.persistMenus(normalized);
  }

  setCurrentRoute(route: string): void {
    const normalizedRoute = this.normalizeRoute(route || MenuService.DEFAULT_ROUTE);
    this.currentRoute.set(normalizedRoute);
    this.writeStorage(MenuService.CURRENT_ROUTE_STORAGE_KEY, normalizedRoute);
  }

  invalidateCache(): void {
    this.topBarMenusState.set([]);
    this.currentRoute.set(MenuService.DEFAULT_ROUTE);
    this.writeStorage(MenuService.CURRENT_ROUTE_STORAGE_KEY, MenuService.DEFAULT_ROUTE);
  }

  private normalizeMenuResponse(
    response: Partial<MenuApiResponse> | null | undefined,
  ): MenuResponse {
    const topBar = this.filterVisibleMenuItems(
      this.normalizeMenuItems(response?.menus ?? response?.topBar ?? []),
    );
    const sideBar = this.filterVisibleMenuItems(
      this.normalizeMenuItems(
        response?.sideBar ??
          topBar.flatMap((item) =>
            Array.isArray(item.children) && item.children.length > 0 ? item.children : [item],
          ),
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

    return items.filter(this.isRecord).map((item) => ({
      id: this.numberValue(item['id']),
      name: this.stringValue(item['name']),
      route: this.stringValue(item['route']),
      icon: this.stringValue(item['icon']),
      displayOrder: this.numberValue(item['displayOrder']),
      parentId: this.nullableNumberValue(item['parentId']),
      type: this.stringValue(item['type'], 'TopBar'),
      children: this.normalizeMenuItems(item['children']),
    }));
  }

  private filterVisibleMenuItems(items: MenuItem[]): MenuItem[] {
    const userRole = this.authService.currentUser()?.role ?? '';
    const canAccessBoard = this.hasRole(userRole, 'Admin', 'Project Manager');
    const canManageProjects = this.hasRole(userRole, 'Admin', 'Project Manager');

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

  private hasRole(userRole: string, ...roles: string[]): boolean {
    const normalizedUserRole = this.normalizeRole(userRole);
    return roles.some((role) => this.normalizeRole(role) === normalizedUserRole);
  }

  private normalizeRole(value: string | null | undefined): string {
    const trimmed = (value ?? '').trim();
    if (!trimmed) {
      return '';
    }

    const compact = trimmed.toLowerCase().replace(/[_-]/g, ' ').replace(/\s+/g, ' ');

    if (compact === 'admin') {
      return 'Admin';
    }

    if (compact === 'project manager' || compact === 'projectmanager') {
      return 'Project Manager';
    }

    if (compact === 'team member' || compact === 'teammember' || compact === 'member') {
      return 'Team Member';
    }

    return trimmed;
  }

  private matchesRoute(menuRoute: string, currentRoute: string): boolean {
    const normalizedMenuRoute = this.normalizeRoute(menuRoute);
    const normalizedCurrentRoute = this.normalizeRoute(currentRoute);

    if (normalizedMenuRoute === normalizedCurrentRoute) {
      return true;
    }

    const menuSegments = this.getRouteSegments(normalizedMenuRoute);
    const currentSegments = this.getRouteSegments(normalizedCurrentRoute);

    if (menuSegments.length === 0 || currentSegments.length === 0) {
      return normalizedCurrentRoute === normalizedMenuRoute;
    }

    return menuSegments.every((segment, index) => currentSegments[index] === segment);
  }

  private getRouteSegments(route: string): string[] {
    return route.split('/').filter((seg) => seg.length > 0);
  }

  private hasMatchingChildRoute(item: MenuItem, currentRoute: string): boolean {
    return (item.children ?? []).some((child) => this.matchesRoute(child.route, currentRoute));
  }

  private normalizeRoute(route: string): string {
    const normalized = route.split('?')[0].split('#')[0].trim();
    const cleaned = normalized.replace(/\/+$/, '');

    if (!cleaned) {
      return MenuService.DEFAULT_ROUTE;
    }

    return cleaned.startsWith('/') ? cleaned : `/${cleaned}`;
  }

  private persistMenus(menus: MenuResponse): void {
    this.writeStorage(MenuService.MENU_STORAGE_KEY, JSON.stringify(menus));
  }

  private readStoredMenus(): MenuResponse {
    try {
      const cached = this.readStorage(MenuService.MENU_STORAGE_KEY);
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
      const cachedRoute = this.readStorage(MenuService.CURRENT_ROUTE_STORAGE_KEY);
      if (cachedRoute) {
        return this.normalizeRoute(cachedRoute);
      }
    } catch {
      // ignore storage access issues and fall back to browser URL
    }

    return this.normalizeRoute(
      typeof window !== 'undefined' ? window.location.pathname : MenuService.DEFAULT_ROUTE,
    );
  }

  private readStorage(key: string): string | null {
    try {
      return typeof window !== 'undefined' ? window.localStorage.getItem(key) : null;
    } catch {
      return null;
    }
  }

  private writeStorage(key: string, value: string): void {
    try {
      if (typeof window !== 'undefined') {
        window.localStorage.setItem(key, value);
      }
    } catch {
      // Storage can be unavailable in restricted browser contexts.
    }
  }

  private isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null;
  }

  private stringValue(value: unknown, fallback = ''): string {
    return typeof value === 'string' ? value : fallback;
  }

  private numberValue(value: unknown, fallback = 0): number {
    return typeof value === 'number' ? value : fallback;
  }

  private nullableNumberValue(value: unknown): number | null {
    return typeof value === 'number' ? value : null;
  }
}
