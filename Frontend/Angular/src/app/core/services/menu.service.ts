import { computed, inject, Injectable, signal } from '@angular/core';
import { AuthService } from './auth.service';
import { MenuApiResponse, MenuItem, MenuResponse } from '../models/menu-item.model';

@Injectable({ providedIn: 'root' })
export class MenuService {
  public static readonly MENU_STORAGE_KEY = 'stms.menus';
  private static readonly CURRENT_ROUTE_STORAGE_KEY = 'stms.current-route';
  private static readonly DEFAULT_ROUTE = '/dashboard';

  private readonly authService = inject(AuthService);

  readonly topBarMenus = signal<MenuItem[]>([]);
  readonly currentRoute = signal<string>(this.readStoredCurrentRoute());

  readonly sideBarMenus = computed<MenuItem[]>(() => {
    const topBar = this.topBarMenus();
    const route = this.currentRoute();

    if (!topBar || topBar.length === 0) {
      return [];
    }

    const selectedTopBar = topBar.find(
      (item) => this.matchesRoute(item.route, route) || this.hasMatchingChildRoute(item, route)
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

  constructor() {
    const cachedMenus = this.readStoredMenus();
    this.topBarMenus.set(cachedMenus.topBar);
    this.currentRoute.set(this.readStoredCurrentRoute());
  }

  setMenuResponse(response: Partial<MenuApiResponse> | null | undefined): void {
    const normalized = this.normalizeMenuResponse(response);
    this.topBarMenus.set(normalized.topBar);
    this.persistMenus(normalized);
  }

  setCurrentRoute(route: string): void {
    const normalizedRoute = this.normalizeRoute(route || MenuService.DEFAULT_ROUTE);
    this.currentRoute.set(normalizedRoute);
    localStorage.setItem(MenuService.CURRENT_ROUTE_STORAGE_KEY, normalizedRoute);
  }

  invalidateCache(): void {
    this.topBarMenus.set([]);
    this.currentRoute.set(MenuService.DEFAULT_ROUTE);
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
      // ignore storage access issues and fall back to browser URL
    }

    return this.normalizeRoute(typeof window !== 'undefined' ? window.location.pathname : MenuService.DEFAULT_ROUTE);
  }
}