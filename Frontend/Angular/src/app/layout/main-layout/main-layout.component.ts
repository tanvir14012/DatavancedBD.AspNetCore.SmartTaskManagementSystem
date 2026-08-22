import { Component, ChangeDetectionStrategy, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { MatSidenavModule } from '@angular/material/sidenav';
import { BreakpointObserver, Breakpoints } from '@angular/cdk/layout';
import { toSignal } from '@angular/core/rxjs-interop';
import { map } from 'rxjs';
import { NavbarComponent } from '../navbar/navbar.component';
import { SidebarComponent } from '../sidebar/sidebar.component';
import { BreadcrumbComponent } from '../breadcrumb/breadcrumb.component';
import { LoadingService } from '../../core/services/loading.service';
import { MatProgressBarModule } from '@angular/material/progress-bar';

@Component({
  selector: 'app-main-layout',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    MatSidenavModule,
    MatProgressBarModule,
    NavbarComponent,
    SidebarComponent,
    BreadcrumbComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (loading.isLoading()) {
      <mat-progress-bar mode="indeterminate" class="global-progress" />
    }
    <mat-sidenav-container autosize class="app-shell">
      <mat-sidenav
        [mode]="isMobile() ? 'over' : 'side'"
        [opened]="isMobile() ? mobileSidenavOpen() : true"
        (openedChange)="onSidenavOpenedChange($event)"
        [class.app-sidenav-collapsed]="!isMobile() && sidebarCollapsed()"
        class="app-sidenav"
      >
        <app-sidebar
          [collapsed]="!isMobile() && sidebarCollapsed()"
          (collapseToggle)="toggleNavigation()"
          (linkClicked)="handleLinkClick()"
        />
      </mat-sidenav>

      <mat-sidenav-content class="app-content">
        <app-navbar
          [sidebarCollapsed]="!isMobile() && sidebarCollapsed()"
          (menuToggle)="toggleNavigation()"
        />
        <main class="app-main">
          <app-breadcrumb />
          <router-outlet />
        </main>
      </mat-sidenav-content>
    </mat-sidenav-container>
  `,
  styles: [
    `
      .global-progress {
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        z-index: 9999;
      }
      .app-shell {
        height: 100vh;
        background: #f5f8fa;
      }
      .app-sidenav {
        width: 280px;
        border-inline-end: 0;
        background: #00533f;
        color: #fff;
        transition: width 180ms ease;
      }
      .app-sidenav-collapsed {
        width: 76px;
      }
      .app-content {
        min-height: 100vh;
        display: flex;
        flex-direction: column;
        background: #f7fafb;
      }
      .app-main {
        flex: 1;
        overflow: auto;
        padding: 12px 16px 20px;
      }
      @media (min-width: 768px) {
        .app-main {
          padding: 14px 22px 22px;
        }
      }
      @media (max-width: 599px) {
        .app-sidenav {
          width: min(86vw, 280px);
        }
      }
    `,
  ],
})
export class MainLayoutComponent {
  readonly loading = inject(LoadingService);

  private readonly breakpoints = inject(BreakpointObserver);
  readonly isMobile = toSignal(
    this.breakpoints
      .observe([Breakpoints.XSmall, Breakpoints.Small])
      .pipe(map((state) => state.matches)),
    { initialValue: false },
  );

  readonly sidebarCollapsed = signal(false);
  readonly mobileSidenavOpen = signal(false);

  toggleNavigation(): void {
    if (this.isMobile()) {
      this.mobileSidenavOpen.update((open) => !open);
    } else {
      this.sidebarCollapsed.update((collapsed) => !collapsed);
    }
  }

  handleLinkClick(): void {
    if (this.isMobile()) {
      this.mobileSidenavOpen.set(false);
    }
  }

  onSidenavOpenedChange(opened: boolean): void {
    if (this.isMobile()) {
      this.mobileSidenavOpen.set(opened);
    }
  }
}
