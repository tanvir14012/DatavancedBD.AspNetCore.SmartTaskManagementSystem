import { Injectable, computed, inject } from '@angular/core';
import { NavigationEnd, Router } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { filter, map, startWith } from 'rxjs';
import {
  ModuleNavigationDto,
  ModuleNavigationService,
  SidebarMenuItemDto,
} from '../../features/administration/module-navigation/module-navigation.service';

export interface NavigationTrail {
  module: ModuleNavigationDto | null;
  rootSidebar: SidebarMenuItemDto | null;
  nestedSidebar: SidebarMenuItemDto | null;
  currentSidebar: SidebarMenuItemDto | null;
}

const ADMIN_ROUTES: Record<string, string> = {
  departments: '/administration/departments',
  roles: '/iam/roles',
  users: '/iam/users',
  'module-navigation': '/administration/module-navigation',
};

@Injectable({ providedIn: 'root' })
export class NavigationShellService {
  private readonly router = inject(Router);
  private readonly navigationService = inject(ModuleNavigationService);

  private readonly currentUrl = toSignal(
    this.router.events.pipe(
      filter((event): event is NavigationEnd => event instanceof NavigationEnd),
      map(() => this.router.url),
      startWith(this.router.url),
    ),
    { initialValue: this.router.url },
  );

  readonly modules = toSignal(
    this.navigationService
      .loadMilitaryModules(1)
      .pipe(
        map((modules) =>
          modules
            .filter((module) => module.isActive)
            .sort((left, right) => left.displayOrder - right.displayOrder),
        ),
      ),
    { initialValue: [] as ModuleNavigationDto[] },
  );

  readonly activeModule = computed(() => this.resolveModule(this.urlSegments(), this.modules()));

  readonly sidebarItems = computed(
    () =>
      this.activeModule()
        ?.sidebarItems.filter((item) => item.isActive)
        .sort((left, right) => left.displayOrder - right.displayOrder) ?? [],
  );

  readonly activeTrail = computed<NavigationTrail>(() => {
    const module = this.activeModule();
    if (!module) {
      return {
        module: null,
        rootSidebar: null,
        nestedSidebar: null,
        currentSidebar: null,
      };
    }

    const viewKey = this.resolveCurrentViewKey(this.urlSegments());
    if (!viewKey) {
      return {
        module,
        rootSidebar: null,
        nestedSidebar: null,
        currentSidebar: null,
      };
    }

    const path = this.findSidebarPath(module.sidebarItems, viewKey);
    return {
      module,
      rootSidebar: path[0] ?? null,
      nestedSidebar: path.length > 1 ? path[path.length - 1] : null,
      currentSidebar: path[path.length - 1] ?? null,
    };
  });

  moduleRoute(module: ModuleNavigationDto): string {
    const moduleKey = this.moduleKey(module);
    if (moduleKey === 'dashboard') {
      return '/dashboard';
    }

    if (moduleKey === 'administration') {
      const firstRoute = this.firstSidebarRoute(module);
      return firstRoute ?? '/administration/departments';
    }

    return `/operations/${moduleKey}`;
  }

  sidebarItemRoute(
    module: ModuleNavigationDto | null | undefined,
    item: SidebarMenuItemDto,
  ): string {
    if (!module) {
      return '/dashboard';
    }

    const moduleKey = this.moduleKey(module);
    const itemKey = this.sidebarKey(item);

    if (moduleKey === 'dashboard') {
      return '/dashboard';
    }

    if (moduleKey === 'administration') {
      const directRoute = ADMIN_ROUTES[itemKey];
      if (directRoute) {
        return directRoute;
      }

      const firstChild = this.firstActiveChild(item);
      if (firstChild) {
        return this.sidebarItemRoute(module, firstChild);
      }
    }

    return `/operations/${moduleKey}/${itemKey}`;
  }

  isModuleActive(module: ModuleNavigationDto): boolean {
    const active = this.activeModule();
    return !!active && this.moduleKey(active) === this.moduleKey(module);
  }

  isSidebarItemActive(item: SidebarMenuItemDto): boolean {
    const trail = this.activeTrail();
    return [trail.rootSidebar, trail.nestedSidebar, trail.currentSidebar].some(
      (active) => !!active && this.sidebarKey(active) === this.sidebarKey(item),
    );
  }

  trackModule(module: ModuleNavigationDto): string {
    return module.id || module.menuId || module.systemName;
  }

  trackSidebarItem(item: SidebarMenuItemDto): string {
    return item.id || item.menuId || item.systemName;
  }

  private firstSidebarRoute(module: ModuleNavigationDto): string | null {
    const firstItem = module.sidebarItems
      .filter((item) => item.isActive)
      .sort((left, right) => left.displayOrder - right.displayOrder)[0];

    return firstItem ? this.sidebarItemRoute(module, firstItem) : null;
  }

  private firstActiveChild(item: SidebarMenuItemDto): SidebarMenuItemDto | null {
    return (
      item.children
        .filter((child) => child.isActive)
        .sort((left, right) => left.displayOrder - right.displayOrder)[0] ?? null
    );
  }

  private resolveModule(
    segments: string[],
    modules: ModuleNavigationDto[],
  ): ModuleNavigationDto | null {
    const primarySegment = segments[0] ?? 'dashboard';
    const moduleKey =
      primarySegment === 'operations'
        ? (segments[1] ?? 'dashboard')
        : primarySegment === 'administration' || primarySegment === 'iam'
          ? 'administration'
          : primarySegment;

    return (
      this.findModule(modules, moduleKey) ??
      this.findModule(modules, 'dashboard') ??
      modules[0] ??
      null
    );
  }

  private resolveCurrentViewKey(segments: string[]): string | null {
    const primarySegment = segments[0] ?? '';
    if (primarySegment === 'operations') {
      return segments[2] ?? null;
    }

    if (primarySegment === 'administration' || primarySegment === 'iam') {
      return segments[1] ?? null;
    }

    if (primarySegment === 'dashboard') {
      return segments[1] ?? null;
    }

    return null;
  }

  private findModule(modules: ModuleNavigationDto[], key: string): ModuleNavigationDto | undefined {
    return modules.find(
      (module) =>
        this.moduleKey(module) === key || module.systemName.toLowerCase() === key.toLowerCase(),
    );
  }

  private findSidebarPath(items: SidebarMenuItemDto[], key: string): SidebarMenuItemDto[] {
    for (const item of items.filter((sidebarItem) => sidebarItem.isActive)) {
      if (this.sidebarKey(item) === key || item.systemName.toLowerCase() === key.toLowerCase()) {
        return [item];
      }

      const childPath = this.findSidebarPath(item.children, key);
      if (childPath.length) {
        return [item, ...childPath];
      }
    }

    return [];
  }

  private moduleKey(module: ModuleNavigationDto): string {
    return this.normalizeRouteKey(module.menuId || module.systemName);
  }

  private sidebarKey(item: SidebarMenuItemDto): string {
    return this.normalizeRouteKey(item.menuId || item.systemName);
  }

  private urlSegments(): string[] {
    return this.currentUrl()
      .split(/[?#]/, 1)[0]
      .split('/')
      .filter(Boolean)
      .map((segment) => decodeURIComponent(segment).toLowerCase());
  }

  private normalizeRouteKey(value: string): string {
    return value.trim().toLowerCase();
  }
}
