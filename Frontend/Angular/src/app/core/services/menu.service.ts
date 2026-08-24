import { HttpClient } from '@angular/common/http';
import { Injectable, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../environments/environment';
import { MenuItem, MenuResponse } from '../models/menu-item.model';

@Injectable({ providedIn: 'root' })
export class MenuService {
  readonly topBarMenus = signal<MenuItem[]>([]);
  readonly sideBarMenus = signal<MenuItem[]>([]);

  constructor(private readonly http: HttpClient) {}

  async loadMenus(): Promise<void> {
    const response = await firstValueFrom(
      this.http.get<MenuResponse>(`${environment.apiBaseUrl}/menus/`),
    );

    this.topBarMenus.set(response.topBar ?? []);
    this.sideBarMenus.set(response.sideBar ?? []);
  }
}
