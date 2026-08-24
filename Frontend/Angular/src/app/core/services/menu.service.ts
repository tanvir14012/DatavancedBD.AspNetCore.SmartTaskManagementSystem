import { HttpClient } from '@angular/common/http';
import { Injectable, signal } from '@angular/core';
import { Observable, map, shareReplay, tap } from 'rxjs';
import { environment } from '../../../environments/environment';
import { MenuItem, MenuResponse } from '../models/menu-item.model';

@Injectable({ providedIn: 'root' })
export class MenuService {
  private static readonly MENU_STORAGE_KEY = 'stms.menus';

  readonly topBarMenus = signal<MenuItem[]>([]);
  readonly sideBarMenus = signal<MenuItem[]>([]);

  private menuRequest$?: Observable<MenuResponse>;

  constructor(private readonly http: HttpClient) {
    const cachedMenus = this.readStoredMenus();
    this.topBarMenus.set(cachedMenus.topBar);
    this.sideBarMenus.set(cachedMenus.sideBar);
  }

  loadMenus(): Observable<MenuResponse> {
    if (!this.menuRequest$) {
      this.menuRequest$ = this.http
        .get<MenuResponse>(`${environment.apiBaseUrl}/menus/`)
        .pipe(
          map((response) => this.normalizeMenuResponse(response)),
          tap((response) => this.persistMenus(response)),
          tap((response) => {
            this.topBarMenus.set(response.topBar);
            this.sideBarMenus.set(response.sideBar);
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

  invalidateCache(): void {
    this.menuRequest$ = undefined;
    this.topBarMenus.set([]);
    this.sideBarMenus.set([]);
  }

  private normalizeMenuResponse(response: Partial<MenuResponse> | null | undefined): MenuResponse {
    const topBar = Array.isArray(response?.topBar) ? (response?.topBar as MenuItem[]) : [];
    const sideBar = topBar.flatMap((item) => {
      const children = Array.isArray(item.children) ? item.children : [];
      return children.length > 0 ? children : [item];
    });

    return {
      topBar,
      sideBar,
    };
  }

  private persistMenus(menus: MenuResponse): void {
    localStorage.setItem(MenuService.MENU_STORAGE_KEY, JSON.stringify(menus));
  }

  private readStoredMenus(): MenuResponse {
    try {
      const cached = localStorage.getItem(MenuService.MENU_STORAGE_KEY);
      if (!cached) {
        return { topBar: [], sideBar: [] };
      }

      const parsed = JSON.parse(cached) as Partial<MenuResponse>;
      return this.normalizeMenuResponse(parsed);
    } catch {
      return { topBar: [], sideBar: [] };
    }
  }
}
