import { Component, ChangeDetectionStrategy, computed, inject, input, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, RouterLinkActive } from '@angular/router';
import { MatListModule } from '@angular/material/list';
import { MatIconModule } from '@angular/material/icon';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatButtonModule } from '@angular/material/button';
import { MatTooltipModule } from '@angular/material/tooltip';
import { TranslateModule } from '@ngx-translate/core';
import { NavigationShellService } from '../navigation-shell/navigation-shell.service';

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    RouterLinkActive,
    MatListModule,
    MatIconModule,
    MatExpansionModule,
    MatButtonModule,
    MatTooltipModule,
    TranslateModule,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="sidebar" [class.collapsed]="collapsed()">
      <div class="sidebar-header">
        <a routerLink="/dashboard" class="brand-link" (click)="linkClicked.emit()">
          <span class="brand-mark">O</span>
          @if (!collapsed()) {
            <span class="brand-copy">
              <span class="brand-name">ORDISS</span>
              <span class="brand-subtitle">{{ moduleTitle() }}</span>
            </span>
          }
        </a>

        <button
          mat-icon-button
          class="collapse-button"
          (click)="collapseToggle.emit()"
          [matTooltip]="
            (collapsed() ? 'navigation.expandSidebar' : 'navigation.collapseSidebar') | translate
          "
        >
          <mat-icon>{{ collapsed() ? 'keyboard_tab' : 'keyboard_backspace' }}</mat-icon>
        </button>
      </div>

      <mat-nav-list class="sidebar-list">
        @for (item of nav.sidebarItems(); track nav.trackSidebarItem(item)) {
          @if (!item.children.length || collapsed()) {
            <a
              mat-list-item
              class="sidebar-link"
              [class.active-group]="nav.isSidebarItemActive(item)"
              [routerLink]="nav.sidebarItemRoute(activeModule(), item)"
              routerLinkActive="active-link"
              [matTooltip]="item.localizedName"
              [matTooltipDisabled]="!collapsed()"
              (click)="linkClicked.emit()"
            >
              <mat-icon matListItemIcon>{{
                item.materialIconName || 'radio_button_unchecked'
              }}</mat-icon>
              @if (!collapsed()) {
                <span matListItemTitle>{{ item.localizedName }}</span>
              }
            </a>
          } @else {
            <mat-expansion-panel class="nav-expansion" [expanded]="nav.isSidebarItemActive(item)">
              <mat-expansion-panel-header>
                <mat-panel-title>
                  <mat-icon>{{ item.materialIconName || 'folder' }}</mat-icon>
                  <span>{{ item.localizedName }}</span>
                </mat-panel-title>
              </mat-expansion-panel-header>
              @for (child of item.children; track nav.trackSidebarItem(child)) {
                @if (child.isActive) {
                  <a
                    mat-list-item
                    class="sidebar-link nested-link"
                    [routerLink]="nav.sidebarItemRoute(activeModule(), child)"
                    routerLinkActive="active-link"
                    (click)="linkClicked.emit()"
                  >
                    <mat-icon matListItemIcon>{{
                      child.materialIconName || 'chevron_right'
                    }}</mat-icon>
                    <span matListItemTitle>{{ child.localizedName }}</span>
                  </a>
                }
              }
            </mat-expansion-panel>
          }
        } @empty {
          @if (!collapsed()) {
            <div class="empty-sidebar">
              <mat-icon>menu_open</mat-icon>
              <span>{{ 'common.loading' | translate }}</span>
            </div>
          }
        }
      </mat-nav-list>

      <div class="sidebar-footer">
        <span class="army-mark"><mat-icon>military_tech</mat-icon></span>
        @if (!collapsed()) {
          <span>Bangladesh Army</span>
        }
      </div>
    </div>
  `,
  styles: [
    `
      :host {
        display: block;
        height: 100%;
        color: #fff;
      }
      .sidebar {
        width: 280px;
        min-height: 100%;
        height: 100%;
        display: flex;
        flex-direction: column;
        background: linear-gradient(180deg, #005a46 0%, #004b3b 100%);
        transition: width 180ms ease;
        overflow: hidden;
      }
      .sidebar.collapsed {
        width: 76px;
      }
      .sidebar-header {
        min-height: 74px;
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 8px;
        padding: 12px 12px 12px 16px;
        border-bottom: 1px solid rgba(255, 255, 255, 0.08);
      }
      .brand-link {
        min-width: 0;
        display: inline-flex;
        align-items: center;
        gap: 10px;
        color: #fff;
        text-decoration: none;
      }
      .brand-mark {
        width: 38px;
        height: 38px;
        border: 2px solid rgba(255, 255, 255, 0.9);
        border-radius: 999px;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        font-size: 24px;
        font-style: italic;
        font-weight: 800;
        line-height: 1;
      }
      .brand-copy {
        display: flex;
        flex-direction: column;
        min-width: 0;
        line-height: 1.05;
      }
      .brand-name {
        font-size: 20px;
        font-weight: 800;
        letter-spacing: 0.12em;
      }
      .brand-subtitle {
        margin-top: 5px;
        max-width: 176px;
        overflow: hidden;
        color: rgba(255, 255, 255, 0.72);
        font-size: 11px;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      .collapse-button {
        flex: 0 0 auto;
        color: rgba(255, 255, 255, 0.86);
      }
      .collapsed .sidebar-header {
        padding-inline: 10px;
        justify-content: center;
        flex-direction: column;
        gap: 8px;
      }
      .collapsed .brand-mark {
        width: 36px;
        height: 36px;
        font-size: 22px;
      }
      .sidebar-list {
        flex: 1;
        padding: 14px 12px;
        overflow: auto;
      }
      .sidebar-link {
        margin: 4px 0;
        border-radius: 8px;
        color: rgba(255, 255, 255, 0.9);
      }
      .nested-link {
        width: calc(100% - 14px);
        margin-inline-start: 14px;
      }
      .active-link,
      .active-group {
        background: rgba(0, 0, 0, 0.22) !important;
        color: #fff !important;
        font-weight: 700;
      }
      .nav-expansion {
        margin: 4px 0;
        border-radius: 8px;
        color: rgba(255, 255, 255, 0.94);
        background: transparent !important;
        box-shadow: none !important;
      }
      .nav-expansion mat-panel-title {
        display: inline-flex;
        align-items: center;
        gap: 12px;
        color: rgba(255, 255, 255, 0.94);
        font-size: 14px;
        font-weight: 600;
      }
      .sidebar-footer {
        min-height: 64px;
        display: flex;
        align-items: center;
        gap: 10px;
        padding: 12px 16px;
        border-top: 1px solid rgba(255, 255, 255, 0.08);
        color: rgba(255, 255, 255, 0.86);
        font-weight: 700;
        white-space: nowrap;
      }
      .army-mark {
        width: 34px;
        height: 34px;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        border: 2px solid #c5a900;
        border-radius: 999px;
        color: #c5a900;
      }
      .empty-sidebar {
        display: flex;
        align-items: center;
        gap: 10px;
        padding: 12px;
        color: rgba(255, 255, 255, 0.72);
      }
      .collapsed .sidebar-list {
        padding-inline: 10px;
      }
      .collapsed .sidebar-link {
        display: flex;
        justify-content: center;
        padding-inline: 0;
      }
      .collapsed .sidebar-footer {
        justify-content: center;
        padding-inline: 0;
      }
      ::ng-deep .sidebar .mat-mdc-list-item {
        --mdc-list-list-item-label-text-color: rgba(255, 255, 255, 0.9);
        --mdc-list-list-item-leading-icon-color: rgba(255, 255, 255, 0.9);
        --mdc-list-list-item-hover-label-text-color: #fff;
        --mdc-list-list-item-hover-leading-icon-color: #fff;
        --mdc-list-list-item-focus-label-text-color: #fff;
        --mdc-list-list-item-focus-leading-icon-color: #fff;
        min-height: 44px;
      }
      ::ng-deep .sidebar .mat-expansion-panel-body {
        padding: 2px 0 6px;
      }
      ::ng-deep .sidebar .mat-expansion-indicator::after {
        color: rgba(255, 255, 255, 0.8);
      }
      ::ng-deep .sidebar .mat-expansion-panel-header {
        height: 44px;
        padding: 0 16px;
        border-radius: 8px;
      }
      ::ng-deep .sidebar .mat-expansion-panel-header:hover {
        background: rgba(255, 255, 255, 0.08) !important;
      }
    `,
  ],
})
export class SidebarComponent {
  readonly collapsed = input(false);
  readonly collapseToggle = output<void>();
  readonly linkClicked = output<void>();
  readonly nav = inject(NavigationShellService);
  readonly activeModule = this.nav.activeModule;
  readonly moduleTitle = computed(() => this.activeModule()?.localizedName ?? 'USM Inventory');
}
