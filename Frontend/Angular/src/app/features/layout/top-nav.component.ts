import { ChangeDetectionStrategy, Component, Input, inject, signal } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { NavigationEnd, Router, RouterLink } from '@angular/router';
import { filter, map, take } from 'rxjs';
import { MenuItem, UserProfile } from '../../core/models/menu-item.model';
import { AuthService } from '../../core/services/auth.service';
import { toSignal } from '@angular/core/rxjs-interop';

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

  readonly currentUrl = toSignal(
    this.router.events.pipe(
      filter((event): event is NavigationEnd => event instanceof NavigationEnd),
      map(event => event.urlAfterRedirects.split(/[?#]/)[0])
    ),
    { initialValue: this.router.url.split(/[?#]/)[0] }
  );

  isItemActive(item: MenuItem): boolean {
    const activeUrl = this.currentUrl();
    const route = item.route;

    return activeUrl === route || activeUrl.startsWith(`${route}/`);
  }

  getItemRoute(item: MenuItem): string {
    return item.route || item.children?.[0]?.route || '/dashboard';
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
