import { Component, ChangeDetectionStrategy, input } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { TranslateModule } from '@ngx-translate/core';

@Component({
  selector: 'app-empty-state',
  standalone: true,
  imports: [MatIconModule, TranslateModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div
      class="empty-state flex flex-col items-center justify-center py-16 text-center text-gray-400"
    >
      <mat-icon class="!text-6xl !w-16 !h-16 mb-4">{{ icon() }}</mat-icon>
      <p class="text-lg font-medium">{{ messageKey() | translate }}</p>
      @if (subMessageKey()) {
        <p class="text-sm mt-1">{{ subMessageKey()! | translate }}</p>
      }
      <ng-content />
    </div>
  `,
})
export class EmptyStateComponent {
  readonly icon = input<string>('inbox');
  readonly messageKey = input<string>('common.noData');
  readonly subMessageKey = input<string | null>(null);
}
