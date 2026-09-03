import { httpResource } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, effect, inject } from '@angular/core';
import { Router, RouterOutlet } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { MenuService } from '../../core/services/menu.service';
import { MenuResponse } from '../../core/models/menu-item.model';
import { environment } from '../../../environments/environment';
import { TopNavComponent } from './top-nav.component';
import { SideNavComponent } from './side-nav.component';

@Component({
  selector: 'app-shell',
  standalone: true,
  imports: [TopNavComponent, SideNavComponent, RouterOutlet],
  templateUrl: './app-shell.component.html',
  styleUrls: ['./app-shell.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AppShellComponent {
  readonly menuService = inject(MenuService);
  readonly authService = inject(AuthService);
  private readonly router = inject(Router);

  readonly menusResource = httpResource<MenuResponse>(() => {
    if (!this.authService.isAuthenticated()) {
      return undefined;
    }

    return {
      url: `${environment.apiBaseUrl}/menus/`,
      withCredentials: true,
    };
  });

  constructor() {
    effect(() => {
      const currentUrl = this.router.url;
      this.menuService.setCurrentRoute(currentUrl);

      const menus = this.menusResource.value();
      if (menus) {
        this.menuService.topBarMenus.set(menus.topBar);
      }
    });
  }
}
