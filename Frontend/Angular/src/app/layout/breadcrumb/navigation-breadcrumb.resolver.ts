import { inject } from '@angular/core';
import { ResolveFn } from '@angular/router';
import { map } from 'rxjs';
import {
  ModuleNavigationDto,
  ModuleNavigationService,
  SidebarMenuItemDto,
} from '../../features/administration/module-navigation/module-navigation.service';

export interface NavigationBreadcrumbContext {
  navId?: string;
  navName?: string;
  rootSidebarId?: string;
  rootSidebarName?: string;
  nestedSidebarId?: string;
  nestedSidebarName?: string;
  featureLabelKey?: string;
}

export const navigationBreadcrumbResolver: ResolveFn<NavigationBreadcrumbContext> = (route) => {
  const navigationService = inject(ModuleNavigationService);
  const moduleKey = route.paramMap.get('module') ?? 'dashboard';
  const sidebarKey = route.paramMap.get('view');
  const featureLabelKey = route.data['breadcrumbFeature'];

  return navigationService.loadMilitaryModules(1).pipe(
    map((modules) => {
      const module = findModule(modules, moduleKey);
      const sidebarPath =
        module && sidebarKey ? findSidebarPath(module.sidebarItems, sidebarKey) : [];

      return {
        navId: module?.id,
        navName: module?.localizedName,
        rootSidebarId: sidebarPath[0]?.id,
        rootSidebarName: sidebarPath[0]?.localizedName,
        nestedSidebarId:
          sidebarPath.length > 1 ? sidebarPath[sidebarPath.length - 1]?.id : undefined,
        nestedSidebarName:
          sidebarPath.length > 1 ? sidebarPath[sidebarPath.length - 1]?.localizedName : undefined,
        featureLabelKey: typeof featureLabelKey === 'string' ? featureLabelKey : undefined,
      };
    }),
  );
};

function findModule(modules: ModuleNavigationDto[], key: string): ModuleNavigationDto | undefined {
  const normalized = normalize(key);
  return modules.find(
    (module) =>
      normalize(module.menuId) === normalized || normalize(module.systemName) === normalized,
  );
}

function findSidebarPath(items: SidebarMenuItemDto[], key: string): SidebarMenuItemDto[] {
  const normalized = normalize(key);
  for (const item of items.filter((sidebarItem) => sidebarItem.isActive)) {
    if (normalize(item.menuId) === normalized || normalize(item.systemName) === normalized) {
      return [item];
    }

    const childPath = findSidebarPath(item.children, key);
    if (childPath.length) {
      return [item, ...childPath];
    }
  }

  return [];
}

function normalize(value: string): string {
  return value.trim().toLowerCase();
}
