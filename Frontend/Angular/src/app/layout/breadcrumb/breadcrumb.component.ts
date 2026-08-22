import { Component, ChangeDetectionStrategy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  ActivatedRoute,
  ActivatedRouteSnapshot,
  NavigationEnd,
  Params,
  Router,
  RouterModule,
} from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { TranslateModule } from '@ngx-translate/core';
import { filter, map, startWith } from 'rxjs';
import { toSignal } from '@angular/core/rxjs-interop';
import { NavigationShellService } from '../navigation-shell/navigation-shell.service';

type BreadcrumbPlaceholder = 'nav' | 'rootSidebar' | 'nestedSidebar' | 'featureName';

interface BreadcrumbConfig {
  label?: string;
  labelKey?: string;
  dataKey?: string;
  paramKey?: string;
  placeholder?: BreadcrumbPlaceholder;
  route?: string | null;
  translate?: boolean;
}

type BreadcrumbRouteData = string | BreadcrumbConfig | BreadcrumbConfig[];

interface Breadcrumb {
  label?: string;
  labelKey?: string;
  route?: string;
}

@Component({
  selector: 'app-breadcrumb',
  standalone: true,
  imports: [CommonModule, RouterModule, MatIconModule, TranslateModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (breadcrumbs().length) {
      <nav aria-label="breadcrumb" class="breadcrumb-bar">
        <ol>
          @for (
            crumb of breadcrumbs();
            track crumb.labelKey ?? crumb.label ?? $index;
            let last = $last
          ) {
            @if (!last && crumb.route) {
              <li>
                <a [routerLink]="crumb.route">
                  @if (crumb.labelKey) {
                    {{ crumb.labelKey | translate }}
                  } @else {
                    {{ crumb.label }}
                  }
                </a>
              </li>
              <li class="separator"><mat-icon>chevron_right</mat-icon></li>
            } @else {
              <li class="current">
                @if (crumb.labelKey) {
                  {{ crumb.labelKey | translate }}
                } @else {
                  {{ crumb.label }}
                }
              </li>
            }
          }
        </ol>
      </nav>
    }
  `,
  styles: [
    `
      .breadcrumb-bar {
        margin: 0 0 14px;
        color: #64748b;
        font-size: 12px;
      }
      ol {
        display: flex;
        align-items: center;
        gap: 6px;
        padding: 0;
        margin: 0;
        list-style: none;
        min-width: 0;
        flex-wrap: wrap;
      }
      a {
        color: #00614b;
        text-decoration: none;
        font-weight: 600;
      }
      a:hover {
        text-decoration: underline;
      }
      .separator {
        display: inline-flex;
        color: #94a3b8;
      }
      .separator mat-icon {
        font-size: 16px;
        width: 16px;
        height: 16px;
      }
      .current {
        color: #475569;
        font-weight: 600;
      }
    `,
  ],
})
export class BreadcrumbComponent {
  private readonly router = inject(Router);
  private readonly activatedRoute = inject(ActivatedRoute);
  private readonly nav = inject(NavigationShellService);

  readonly breadcrumbs = toSignal(
    this.router.events.pipe(
      filter((event): event is NavigationEnd => event instanceof NavigationEnd),
      map(() => this.buildBreadcrumbs(this.activatedRoute.root)),
      startWith(this.buildBreadcrumbs(this.activatedRoute.root)),
    ),
    { initialValue: [] as Breadcrumb[] },
  );

  private buildBreadcrumbs(route: ActivatedRoute): Breadcrumb[] {
    const crumbs: Breadcrumb[] = [];
    let current: ActivatedRoute | null = route;

    while (current.firstChild) {
      current = current.firstChild;
      const config = current.snapshot.data['breadcrumb'] as BreadcrumbRouteData | undefined;
      if (!config) {
        continue;
      }

      const entries = Array.isArray(config) ? config : [config];
      const routeUrl = this.routeUrl(current.snapshot);

      for (const entry of entries) {
        const crumb = this.resolveCrumb(entry, current.snapshot, routeUrl);
        if (crumb) {
          crumbs.push(crumb);
        }
      }
    }

    return this.removeDuplicates(crumbs);
  }

  private resolveCrumb(
    entry: string | BreadcrumbConfig,
    snapshot: ActivatedRouteSnapshot,
    routeUrl: string,
  ): Breadcrumb | null {
    if (typeof entry === 'string') {
      return { labelKey: entry, route: routeUrl };
    }

    const resolvedValue = this.resolveEntryValue(entry, snapshot.data, snapshot.params);
    if (!resolvedValue) {
      return null;
    }

    return {
      label: entry.translate ? undefined : resolvedValue,
      labelKey: entry.translate ? resolvedValue : undefined,
      route: entry.route === null ? undefined : (entry.route ?? routeUrl),
    };
  }

  private resolveEntryValue(entry: BreadcrumbConfig, data: Params, params: Params): string | null {
    if (entry.labelKey) {
      return entry.labelKey;
    }

    if (entry.label) {
      return entry.label;
    }

    if (entry.dataKey) {
      const dataValue = this.lookupPath(data, entry.dataKey);
      if (typeof dataValue === 'string' && dataValue.trim()) {
        return dataValue;
      }
    }

    if (entry.paramKey) {
      const paramValue = params[entry.paramKey];
      if (typeof paramValue === 'string' && paramValue.trim()) {
        return paramValue;
      }
    }

    return entry.placeholder ? this.resolvePlaceholder(entry.placeholder) : null;
  }

  private resolvePlaceholder(placeholder: BreadcrumbPlaceholder): string | null {
    const trail = this.nav.activeTrail();
    switch (placeholder) {
      case 'nav':
        return trail.module?.localizedName ?? null;
      case 'rootSidebar':
        return trail.rootSidebar?.localizedName ?? null;
      case 'nestedSidebar':
        return trail.nestedSidebar?.localizedName ?? null;
      case 'featureName':
        return trail.currentSidebar?.localizedName ?? null;
    }
  }

  private lookupPath(source: Params, path: string): unknown {
    return path.split('.').reduce<unknown>((current, segment) => {
      if (current && typeof current === 'object' && segment in current) {
        return (current as Record<string, unknown>)[segment];
      }

      return undefined;
    }, source);
  }

  private routeUrl(snapshot: ActivatedRouteSnapshot): string {
    const path = snapshot.pathFromRoot
      .flatMap((route) => route.url.map((segment) => segment.path))
      .filter(Boolean)
      .join('/');

    return `/${path}`;
  }

  private removeDuplicates(crumbs: Breadcrumb[]): Breadcrumb[] {
    return crumbs.filter((crumb, index) => {
      const value = crumb.labelKey ?? crumb.label;
      const previous = crumbs[index - 1];
      return !!value && value !== (previous?.labelKey ?? previous?.label);
    });
  }
}
