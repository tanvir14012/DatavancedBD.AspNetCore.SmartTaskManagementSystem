import { inject } from '@angular/core';
import { ResolveFn } from '@angular/router';
import { Observable, map } from 'rxjs';
import { MenuService } from '../services/menu.service';

export const dashboardResolver: ResolveFn<{ isReady: boolean }> = (): Observable<{ isReady: boolean }> => {
  const menuService = inject(MenuService);

  return menuService.loadMenus().pipe(map(() => ({ isReady: true })));
};
