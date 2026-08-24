import { Component, Input } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { MenuItem } from '../../core/models/menu-item.model';

@Component({
  selector: 'app-side-nav',
  standalone: true,
  imports: [RouterLink, RouterLinkActive],
  template: `
    <aside class="side-nav">
      @for (item of items; track item.id) {
        <div class="nav-group">
          <a
            class="nav-link"
            [routerLink]="item.route"
            routerLinkActive="active"
            [routerLinkActiveOptions]="{ exact: false }"
          >
            <span class="icon">{{ item.icon }}</span>
            <span>{{ item.name }}</span>
          </a>

          @if (item.children && item.children.length > 0) {
            <div class="sub-links">
              @for (child of item.children; track child.id) {
                <a
                  class="sub-link"
                  [routerLink]="child.route"
                  routerLinkActive="active"
                  [routerLinkActiveOptions]="{ exact: false }"
                >
                  {{ child.name }}
                </a>
              }
            </div>
          }
        </div>
      }
    </aside>
  `,
  styles: [
    `
      .side-nav {
        width: 260px;
        background: #0f172a;
        border-right: 1px solid rgba(148, 163, 184, 0.12);
        padding: 20px 16px;
        color: #e2e8f0;
      }

      .nav-group {
        margin-bottom: 18px;
      }

      .nav-link {
        display: flex;
        align-items: center;
        gap: 10px;
        text-decoration: none;
        color: #e2e8f0;
        padding: 10px 12px;
        border-radius: 10px;
        font-weight: 600;
      }

      .nav-link.active,
      .nav-link:hover {
        background: rgba(59, 130, 246, 0.18);
        color: white;
      }

      .icon {
        width: 26px;
        height: 26px;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        border-radius: 8px;
        background: rgba(59, 130, 246, 0.12);
      }

      .sub-links {
        display: flex;
        flex-direction: column;
        gap: 8px;
        margin-top: 8px;
        padding-left: 15px;
      }

      .sub-link {
        text-decoration: none;
        color: #cbd5e1;
        padding: 8px 10px;
        border-radius: 8px;
      }

      .sub-link.active,
      .sub-link:hover {
        background: rgba(148, 163, 184, 0.12);
        color: white;
      }
    `,
  ],
})
export class SideNavComponent {
  @Input() items: MenuItem[] = [];
}
