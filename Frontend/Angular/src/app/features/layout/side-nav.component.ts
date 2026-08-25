import { Component, Input, inject } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { Router, RouterLink } from '@angular/router';
import { MenuItem } from '../../core/models/menu-item.model';

@Component({
  selector: 'app-side-nav',
  standalone: true,
  imports: [RouterLink, MatIconModule],
  templateUrl: './side-nav.component.html',
  styleUrls: ['./side-nav.component.scss']
})
export class SideNavComponent {
  @Input() items: MenuItem[] = [];

  private readonly router = inject(Router);

  isParentActive(item: MenuItem): boolean {
    if (!item.route) {
      return false;
    }

    const currentUrl = this.router.url.split('?')[0].split('#')[0];
    const isCurrentItem = this.matchesRoute(item.route, currentUrl);
    const hasActiveChild = (item.children ?? []).some((child) => this.matchesRoute(child.route, currentUrl));

    return isCurrentItem && !hasActiveChild;
  }

  isChildActive(route: string): boolean {
    if (!route) {
      return false;
    }

    const currentUrl = this.router.url.split('?')[0].split('#')[0];
    return this.matchesRoute(route, currentUrl);
  }

  private matchesRoute(menuRoute: string, currentRoute: string): boolean {
    const normalizedMenuRoute = this.normalizeRoute(menuRoute);
    const normalizedCurrentRoute = this.normalizeRoute(currentRoute);
    const menuSegments = this.getRouteSegments(normalizedMenuRoute);
    const currentSegments = this.getRouteSegments(normalizedCurrentRoute);

    if (menuSegments.length === 0 || currentSegments.length === 0) {
      return normalizedCurrentRoute === normalizedMenuRoute;
    }

    // Match at least the first segment (e.g., 'projects' in '/projects/list')
    // This ensures /projects/3/edit matches /projects/list
    return currentSegments[0] === menuSegments[0] && currentSegments[1] === menuSegments[1];
  }

  private getRouteSegments(route: string): string[] {
    return route.split('/').filter((seg) => seg.length > 0);
  }

  private normalizeRoute(route: string): string {
    const normalized = route.split('?')[0].split('#')[0].trim();
    const cleaned = normalized.replace(/\/+$/, '');

    if (!cleaned) {
      return '/dashboard';
    }

    return cleaned.startsWith('/') ? cleaned : `/${cleaned}`;
  }
}
