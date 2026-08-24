import { Component, Input, signal } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { MenuItem, UserProfile } from '../../core/models/menu-item.model';

@Component({
  selector: 'app-top-nav',
  standalone: true,
  imports: [RouterLink, RouterLinkActive],
  template: `
    <header class="top-nav">
      <nav class="nav-left" aria-label="Main navigation">
        @for (item of menus; track item.id) {
          <a
            class="nav-item"
            [routerLink]="item.route"
            routerLinkActive="active"
            [routerLinkActiveOptions]="{ exact: true }"
          >
            <span class="icon">{{ item.icon }}</span>
            <span>{{ item.name }}</span>
          </a>
        }
      </nav>

      <div class="nav-right">
        <button class="icon-btn" aria-label="Notifications">🔔</button>
        <div class="user-card">
          <img [src]="user?.imageUrl ?? 'https://api.dicebear.com/7.x/initials/svg?seed=User'" alt="User avatar" />
          <div>
            <strong>{{ user?.name ?? 'Guest User' }}</strong>
            <small>{{ user?.role ?? 'Team Member' }}</small>
          </div>
        </div>
      </div>
    </header>
  `,
  styles: [
    `
      .top-nav {
        height: 72px;
        background: rgba(15, 23, 42, 0.92);
        border-bottom: 1px solid rgba(148, 163, 184, 0.15);
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 0 24px;
      }

      .nav-left {
        display: flex;
        align-items: center;
        gap: 10px;
        flex: 1;
      }

      .nav-item {
        display: inline-flex;
        align-items: center;
        gap: 8px;
        text-decoration: none;
        color: #dbeafe;
        padding: 10px 14px;
        border-radius: 10px;
        transition: all 0.2s ease;
        font-weight: 600;
      }

      .nav-item.active,
      .nav-item:hover {
        background: rgba(59, 130, 246, 0.18);
        color: white;
      }

      .icon {
        font-size: 1.1rem;
      }

      .nav-right {
        display: flex;
        align-items: center;
        gap: 16px;
      }

      .icon-btn {
        width: 38px;
        height: 38px;
        border-radius: 50%;
        border: 1px solid rgba(148, 163, 184, 0.25);
        background: rgba(148, 163, 184, 0.08);
        color: white;
      }

      .user-card {
        display: flex;
        align-items: center;
        gap: 10px;
        padding: 8px 12px;
        border-radius: 999px;
        background: rgba(148, 163, 184, 0.08);
        border: 1px solid rgba(148, 163, 184, 0.16);
        color: white;
      }

      .user-card img {
        width: 36px;
        height: 36px;
        border-radius: 50%;
        object-fit: cover;
      }

      .user-card strong,
      .user-card small {
        display: block;
      }

      .user-card small {
        color: #bfdbfe;
      }
    `,
  ],
})
export class TopNavComponent {
  @Input() menus: MenuItem[] = [];
  @Input() user: UserProfile | null = null;
}
