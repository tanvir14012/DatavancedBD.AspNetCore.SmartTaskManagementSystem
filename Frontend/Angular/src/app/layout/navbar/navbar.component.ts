import { Component, ChangeDetectionStrategy, computed, inject, input, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatBadgeModule } from '@angular/material/badge';
import { TranslateModule } from '@ngx-translate/core';
import { AuthService } from '../../core/auth/auth.service';
import { LanguageService } from '../../core/services/language.service';
import { RouterModule } from '@angular/router';
import { BreakpointObserver, Breakpoints } from '@angular/cdk/layout';
import { toSignal } from '@angular/core/rxjs-interop';
import { map } from 'rxjs';
import { NavigationShellService } from '../navigation-shell/navigation-shell.service';

@Component({
  selector: 'app-navbar',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    MatToolbarModule,
    MatButtonModule,
    MatIconModule,
    MatMenuModule,
    MatTooltipModule,
    MatBadgeModule,
    TranslateModule,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <mat-toolbar class="app-navbar">
      <button
        mat-icon-button
        class="shell-toggle"
        (click)="menuToggle.emit()"
        [matTooltip]="
          (sidebarCollapsed() ? 'navigation.expandSidebar' : 'navigation.collapseSidebar')
            | translate
        "
      >
        <mat-icon>{{ sidebarCollapsed() ? 'keyboard_tab' : 'menu' }}</mat-icon>
      </button>

      <nav class="module-nav" aria-label="Module navigation">
        @for (module of primaryModules(); track nav.trackModule(module)) {
          <a
            mat-button
            class="module-tab"
            [class.active]="nav.isModuleActive(module)"
            [routerLink]="nav.moduleRoute(module)"
            [matTooltip]="module.localizedName"
          >
            <span class="module-icon"
              ><mat-icon>{{ module.materialIconName || 'apps' }}</mat-icon></span
            >
            <span class="module-label">{{ module.localizedName }}</span>
          </a>
        }

        @if (overflowModules().length) {
          <button
            mat-button
            class="module-tab more-tab"
            [class.active]="overflowHasActive()"
            [matMenuTriggerFor]="moduleMenu"
          >
            <span class="module-icon"><mat-icon>more_horiz</mat-icon></span>
            <span class="module-label">{{ 'navigation.others' | translate }}</span>
            <mat-icon class="chevron">expand_more</mat-icon>
          </button>
        }
      </nav>

      <mat-menu #moduleMenu="matMenu" class="module-overflow-menu">
        @for (module of overflowModules(); track nav.trackModule(module)) {
          <a
            mat-menu-item
            [routerLink]="nav.moduleRoute(module)"
            [class.active-overflow]="nav.isModuleActive(module)"
          >
            <mat-icon>{{ module.materialIconName || 'apps' }}</mat-icon>
            <span>{{ module.localizedName }}</span>
          </a>
        }
      </mat-menu>

      <span class="navbar-spacer"></span>

      <button mat-stroked-button class="language-button" [matMenuTriggerFor]="langMenu">
        <mat-icon>language</mat-icon>
        <span>{{ languageLabel() }}</span>
        <mat-icon class="chevron">expand_more</mat-icon>
      </button>
      <mat-menu #langMenu>
        <button mat-menu-item (click)="langSvc.use('en')">
          <span>English</span>
        </button>
        <button mat-menu-item (click)="langSvc.use('bn')">
          <span>বাংলা</span>
        </button>
        <button mat-menu-item (click)="langSvc.use('ar')">
          <span>العربية</span>
        </button>
      </mat-menu>

      <button
        mat-icon-button
        class="notification-button"
        [matBadge]="13"
        matBadgeColor="warn"
        matBadgeSize="small"
        [matTooltip]="'common.notifications' | translate"
      >
        <mat-icon>notifications_none</mat-icon>
      </button>

      <button mat-button class="user-chip" [matMenuTriggerFor]="userMenu">
        <span class="avatar">{{ initials() }}</span>
        <span class="user-copy">
          <span class="user-name">{{ displayName() }}</span>
          <span class="user-role">General | COAS</span>
        </span>
      </button>
      <mat-menu #userMenu>
        <div class="px-4 py-2 border-b border-gray-200">
          <p class="font-medium text-sm">{{ displayName() }}</p>
          <p class="text-xs text-gray-500">
            {{ authSvc.currentUser()?.email ?? 'General | COAS' }}
          </p>
        </div>
        <button mat-menu-item routerLink="/profile">
          <mat-icon>person</mat-icon> {{ 'common.profile' | translate }}
        </button>
        <button mat-menu-item (click)="authSvc.logout()">
          <mat-icon>logout</mat-icon> {{ 'auth.signOut' | translate }}
        </button>
      </mat-menu>
    </mat-toolbar>
  `,
  styles: [
    `
      .app-navbar {
        position: sticky;
        top: 0;
        z-index: 100;
        min-height: 64px;
        height: 64px;
        gap: 10px;
        padding: 0 14px;
        background: #fff;
        color: #1f2937;
        border-bottom: 1px solid rgba(15, 23, 42, 0.08);
        box-shadow: 0 1px 8px rgba(15, 23, 42, 0.05);
      }
      .shell-toggle {
        color: #00614b;
      }
      .module-nav {
        display: flex;
        align-items: center;
        gap: 10px;
        min-width: 0;
      }
      .module-tab {
        height: 42px;
        border-radius: 10px;
        padding: 0 12px;
        color: #4b5563;
        background: transparent;
      }
      .module-tab.active {
        color: #00614b;
        background: #e2f0ec;
        box-shadow: inset 0 0 0 1px rgba(0, 97, 75, 0.28);
      }
      .module-icon {
        width: 28px;
        height: 28px;
        border-radius: 8px;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        margin-inline-end: 8px;
        background: #edf4f2;
        color: #00614b;
      }
      .module-icon mat-icon {
        font-size: 18px;
        width: 18px;
        height: 18px;
      }
      .more-tab .chevron,
      .language-button .chevron {
        font-size: 18px;
        width: 18px;
        height: 18px;
        margin-inline-start: 2px;
      }
      .navbar-spacer {
        flex: 1 1 auto;
        min-width: 8px;
      }
      .language-button {
        height: 36px;
        border-color: rgba(0, 97, 75, 0.5) !important;
        color: #00614b !important;
        border-radius: 8px;
      }
      .notification-button {
        color: #475569;
      }
      .user-chip {
        height: 44px;
        border-radius: 10px;
        padding: 0 10px 0 6px;
        background: #eef4f1;
        color: #1f2937;
      }
      .avatar {
        width: 34px;
        height: 34px;
        border-radius: 10px;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        margin-inline-end: 8px;
        color: #fff;
        background: linear-gradient(135deg, #00936f, #00533f);
        font-size: 12px;
        font-weight: 700;
      }
      .user-copy {
        display: flex;
        flex-direction: column;
        align-items: flex-start;
        line-height: 1.1;
        max-width: 190px;
      }
      .user-name {
        font-size: 13px;
        font-weight: 700;
        max-width: 190px;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      .user-role {
        color: #6b7280;
        font-size: 11px;
        margin-top: 3px;
      }
      .active-overflow {
        color: #00614b;
        background: #e2f0ec;
      }
      @media (max-width: 900px) {
        .module-label {
          max-width: 112px;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .user-copy {
          display: none;
        }
        .user-chip {
          min-width: 44px;
          padding: 0 5px;
        }
        .avatar {
          margin-inline-end: 0;
        }
      }
      @media (max-width: 599px) {
        .app-navbar {
          min-height: 58px;
          height: 58px;
          padding: 0 8px;
          gap: 6px;
        }
        .language-button span {
          display: none;
        }
        .module-tab {
          min-width: 42px;
          padding: 0 8px;
        }
        .module-icon {
          margin-inline-end: 0;
        }
        .module-label {
          display: none;
        }
      }
    `,
  ],
})
export class NavbarComponent {
  readonly sidebarCollapsed = input(false);
  readonly menuToggle = output<void>();
  readonly authSvc = inject(AuthService);
  readonly langSvc = inject(LanguageService);
  readonly nav = inject(NavigationShellService);
  private readonly breakpoints = inject(BreakpointObserver);

  private readonly visibleModuleLimit = toSignal(
    this.breakpoints
      .observe([
        Breakpoints.XSmall,
        Breakpoints.Small,
        Breakpoints.Medium,
        Breakpoints.Large,
        Breakpoints.XLarge,
      ])
      .pipe(
        map((state) => {
          if (state.breakpoints[Breakpoints.XSmall]) return 0;
          if (state.breakpoints[Breakpoints.Small]) return 1;
          if (state.breakpoints[Breakpoints.Medium]) return 3;
          if (state.breakpoints[Breakpoints.Large]) return 4;
          return 5;
        }),
      ),
    { initialValue: 5 },
  );

  readonly primaryModules = computed(() =>
    this.nav.modules().slice(0, Math.min(this.visibleModuleLimit(), this.nav.modules().length)),
  );

  readonly overflowModules = computed(() => this.nav.modules().slice(this.primaryModules().length));

  readonly overflowHasActive = computed(() =>
    this.overflowModules().some((module) => this.nav.isModuleActive(module)),
  );

  readonly languageLabel = computed(() => this.langSvc.currentLang().toUpperCase());

  readonly displayName = computed(() => {
    const user = this.authSvc.currentUser();
    return user?.name || user?.preferred_username || 'L. C. MD. Mohsinul Haque';
  });

  readonly initials = computed(
    () =>
      this.displayName()
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, 2)
        .map((part) => part[0]?.toUpperCase() ?? '')
        .join('') || 'U',
  );
}
