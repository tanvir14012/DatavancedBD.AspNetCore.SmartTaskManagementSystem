import { Component, OnInit } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { MenuService } from '../../core/services/menu.service';
import { TopNavComponent } from './top-nav.component';
import { SideNavComponent } from './side-nav.component';

@Component({
  selector: 'app-shell',
  standalone: true,
  imports: [TopNavComponent, SideNavComponent, RouterOutlet],
  template: `
    <div class="app-shell">
      <app-top-nav [menus]="menuService.topBarMenus()" [user]="authService.currentUser()"></app-top-nav>

      <div class="content-shell">
        <app-side-nav [items]="menuService.sideBarMenus()"></app-side-nav>

        <main class="page-shell">
          <router-outlet />
        </main>
      </div>
    </div>
  `,
  styles: [
    `
      :host {
        display: block;
        min-height: 100vh;
        background: #f8fafc;
      }

      .app-shell {
        min-height: 100vh;
        display: flex;
        flex-direction: column;
      }

      .content-shell {
        display: flex;
        flex: 1;
        min-height: 0;
      }

      .page-shell {
        flex: 1;
        padding: 32px;
        overflow: auto;
      }
    `,
  ],
})
export class AppShellComponent implements OnInit {
  constructor(
    public readonly menuService: MenuService,
    public readonly authService: AuthService,
  ) {}

  async ngOnInit(): Promise<void> {
    await this.menuService.loadMenus();
  }
}
