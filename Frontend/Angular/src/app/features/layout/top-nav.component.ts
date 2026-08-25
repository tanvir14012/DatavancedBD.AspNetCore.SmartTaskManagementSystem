import { ChangeDetectionStrategy, Component, Input, inject, signal } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { Router, RouterLink } from '@angular/router';
import { take } from 'rxjs';
import { MenuItem, UserProfile } from '../../core/models/menu-item.model';
import { AuthService } from '../../core/services/auth.service';

@Component({
  selector: 'app-top-nav',
  standalone: true,
  imports: [RouterLink, MatIconModule],
  templateUrl: './top-nav.component.html',
  styleUrls: ['./top-nav.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TopNavComponent {
  @Input() menus: MenuItem[] = [];
  @Input() user: UserProfile | null = null;

  readonly userMenuOpen = signal(false);

  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);

  getItemRoute(item: MenuItem): string {
    return item.route || item.children?.[0]?.route || '/dashboard';
  }

  isItemActive(item: MenuItem): boolean {
    const currentUrl = this.router.url.split('?')[0].split('#')[0];
    const targetRoute = this.getItemRoute(item);

    return this.matchesRoute(targetRoute, currentUrl) || (item.children ?? []).some((child) => this.matchesRoute(child.route, currentUrl));
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

  toggleUserMenu(): void {
    this.userMenuOpen.update((open) => !open);
  }

  logout(): void {
    this.userMenuOpen.set(false);
    this.authService
      .logout()
      .pipe(take(1))
      .subscribe({
        next: () => {
          this.router.navigateByUrl('/homepage');
        },
        error: () => {
          this.router.navigateByUrl('/homepage');
        },
      });
  }
}
