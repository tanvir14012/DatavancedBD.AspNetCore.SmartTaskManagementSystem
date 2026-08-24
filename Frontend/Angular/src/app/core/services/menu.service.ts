import { HttpClient } from '@angular/common/http';
import { computed, Injectable, signal } from '@angular/core';
import { Observable, map, shareReplay, tap } from 'rxjs';
import { environment } from '../../../environments/environment';
import { MenuApiResponse, MenuItem, MenuResponse } from '../models/menu-item.model';

@Injectable({ providedIn: 'root' })
export class MenuService {
  private static readonly MENU_STORAGE_KEY = 'stms.menus';

  readonly topBarMenus = signal<MenuItem[]>([]);
  readonly currentRoute = signal<string>('/dashboard');
  readonly sideBarMenus = computed<MenuItem[]>(() => {
    const topBar = this.topBarMenus();
    const route = this.currentRoute();

    if (!topBar.length) {
      return [];
    }

    const selectedTopBar = topBar.find((item) => this.matchesRoute(item.route, route) || this.hasMatchingChildRoute(item, route));

    if (selectedTopBar) {
      return selectedTopBar.children.length > 0 ? selectedTopBar.children : [selectedTopBar];
    }

    return topBar.flatMap((item) => (item.children.length > 0 ? item.children : [item]));
  });

  private menuRequest$?: Observable<MenuResponse>;

  constructor(private readonly http: HttpClient) {
    const cachedMenus = this.readStoredMenus();
    this.topBarMenus.set(cachedMenus.topBar);
  }

  loadMenus(): Observable<MenuResponse> {
    if (!this.menuRequest$) {
      this.menuRequest$ = this.http
        .get<MenuApiResponse>(`${environment.apiBaseUrl}/menus/`)
        .pipe(
          map((response) => this.normalizeMenuResponse(response)),
          tap((response) => this.persistMenus(response)),
          tap((response) => {
            this.topBarMenus.set(response.topBar);
          }),
          shareReplay({ bufferSize: 1, refCount: true }),
        );
    }

    return this.menuRequest$;
  }

  refreshMenus(): Observable<MenuResponse> {
    this.invalidateCache();
    return this.loadMenus();
  }

  clearMenus(): void {
    this.invalidateCache();
    localStorage.removeItem(MenuService.MENU_STORAGE_KEY);
  }

  setCurrentRoute(route: string): void {
    this.currentRoute.set(route || '/dashboard');
  }

  invalidateCache(): void {
    this.menuRequest$ = undefined;
    this.topBarMenus.set([]);
    this.currentRoute.set('/dashboard');
  }

  private normalizeMenuResponse(response: Partial<MenuApiResponse> | null | undefined): MenuResponse {
    const topBar = this.normalizeMenuItems(response?.menus ?? response?.topBar ?? []);
    const sideBar = this.normalizeMenuItems(
      response?.sideBar ?? topBar.flatMap((item) => (Array.isArray(item.children) && item.children.length > 0 ? item.children : [item])),
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

  private matchesRoute(menuRoute: string, currentRoute: string): boolean {
    const normalizedMenuRoute = this.normalizeRoute(menuRoute);
    const normalizedCurrentRoute = this.normalizeRoute(currentRoute);

    return normalizedCurrentRoute === normalizedMenuRoute || normalizedCurrentRoute.startsWith(`${normalizedMenuRoute}/`);
  }

  private hasMatchingChildRoute(item: MenuItem, currentRoute: string): boolean {
    return (item.children ?? []).some((child) => this.matchesRoute(child.route, currentRoute));
  }

  private normalizeRoute(route: string): string {
    return route.split('?')[0].split('#')[0].trim() || '/';
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
}
