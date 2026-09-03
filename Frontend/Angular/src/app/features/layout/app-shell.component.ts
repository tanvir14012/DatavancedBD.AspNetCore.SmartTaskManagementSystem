import { httpResource } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, effect, inject } from '@angular/core';
import { NavigationEnd, Router, RouterOutlet } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { filter, map } from 'rxjs';
import { environment } from '../../../environments/environment';
import { MenuResponse } from '../../core/models/menu-item.model';
import { AuthService } from '../../core/services/auth.service';
import { MenuService } from '../../core/services/menu.service';
import { SideNavComponent } from './side-nav.component';
import { TopNavComponent } from './top-nav.component';

@Component({
  selector: 'app-shell',
  standalone: true,
  imports: [TopNavComponent, SideNavComponent, RouterOutlet],
  templateUrl: './app-shell.component.html',
  styleUrl: './app-shell.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AppShellComponent {
  readonly menuService = inject(MenuService);
  readonly authService = inject(AuthService);
  private readonly router = inject(Router);

  readonly currentUrl = toSignal(
    this.router.events.pipe(
      filter((event): event is NavigationEnd => event instanceof NavigationEnd),
      map((event) => event.urlAfterRedirects || event.url),
    ),
    { initialValue: this.router.url },
  );

  readonly menusResource = httpResource<MenuResponse>(() => {
    if (!this.authService.isAuthenticated()) {
      return undefined;
    }

    return {
      url: `${environment.apiBaseUrl}/menus`,
      withCredentials: true,
    };
  });

  constructor() {
    effect(() => {
      this.menuService.setCurrentRoute(this.currentUrl());
    });

    effect(() => {
      const menus = this.menusResource.value();
      if (menus) {
        this.menuService.setMenuResponse(menus);
      }
    });
  }
}
