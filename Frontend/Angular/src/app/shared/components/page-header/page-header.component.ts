import { Component, ChangeDetectionStrategy, input } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { TranslateModule } from '@ngx-translate/core';
import { RouterModule } from '@angular/router';
import { HasPermissionDirective } from '../../directives/has-permission.directive';

export interface PageAction {
  labelKey: string;
  icon?: string;
  permission?: string;
  color?: 'primary' | 'accent' | 'warn';
  action: () => void;
}

@Component({
  selector: 'app-page-header',
  standalone: true,
  imports: [
    MatButtonModule,
    MatIconModule,
    MatTooltipModule,
    TranslateModule,
    RouterModule,
    HasPermissionDirective,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page-header flex items-center justify-between py-4 px-0">
      <div>
        <h1 class="text-2xl font-semibold text-gray-800 dark:text-gray-100 m-0">
          {{ titleKey() | translate }}
        </h1>
        @if (subtitleKey()) {
          <p class="text-sm text-gray-500 mt-0.5">{{ subtitleKey()! | translate }}</p>
        }
      </div>
      <div class="flex gap-2">
        @for (action of actions(); track action.labelKey) {
          @if (!action.permission) {
            <button mat-flat-button [color]="action.color || 'primary'" (click)="action.action()">
              @if (action.icon) {
                <mat-icon>{{ action.icon }}</mat-icon>
              }
              {{ action.labelKey | translate }}
            </button>
          } @else {
            <button
              mat-flat-button
              [color]="action.color || 'primary'"
              (click)="action.action()"
              *hasPermission="action.permission"
            >
              @if (action.icon) {
                <mat-icon>{{ action.icon }}</mat-icon>
              }
              {{ action.labelKey | translate }}
            </button>
          }
        }
      </div>
    </div>
  `,
})
export class PageHeaderComponent {
  readonly titleKey = input.required<string>();
  readonly subtitleKey = input<string | null>(null);
  readonly actions = input<PageAction[]>([]);
}
