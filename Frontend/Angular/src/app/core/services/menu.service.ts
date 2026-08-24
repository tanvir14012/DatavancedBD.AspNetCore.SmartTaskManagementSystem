import { HttpClient } from '@angular/common/http';
import { Injectable, signal } from '@angular/core';
import { Observable, map, shareReplay, tap } from 'rxjs';
import { environment } from '../../../environments/environment';
import { MenuItem, MenuResponse } from '../models/menu-item.model';

@Injectable({ providedIn: 'root' })
export class MenuService {
  readonly topBarMenus = signal<MenuItem[]>([]);
  readonly sideBarMenus = signal<MenuItem[]>([]);

  private menuRequest$?: Observable<MenuResponse>;

  constructor(private readonly http: HttpClient) {}

  loadMenus(): Observable<MenuResponse> {
    if (!this.menuRequest$) {
      this.menuRequest$ = this.http
        .get<MenuResponse>(`${environment.apiBaseUrl}/menus/`)
        .pipe(
          map((response) => ({
            topBar: response.topBar ?? [],
            sideBar: response.sideBar ?? [],
          })),
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

  invalidateCache(): void {
    this.menuRequest$ = undefined;
    this.topBarMenus.set([]);
    this.sideBarMenus.set([]);
  }
}
