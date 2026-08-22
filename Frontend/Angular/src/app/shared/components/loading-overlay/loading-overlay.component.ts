import { Component, ChangeDetectionStrategy, input } from '@angular/core';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-loading-overlay',
  standalone: true,
  imports: [CommonModule, MatProgressSpinnerModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (isLoading()) {
      <div class="loading-overlay">
        <mat-progress-spinner mode="indeterminate" [diameter]="48" />
      </div>
    }
  `,
  styles: [
    `
      .loading-overlay {
        position: absolute;
        inset: 0;
        display: flex;
        align-items: center;
        justify-content: center;
        background: rgba(255, 255, 255, 0.6);
        z-index: 100;
        backdrop-filter: blur(2px);
      }
      :host-context(.dark) .loading-overlay {
        background: rgba(0, 0, 0, 0.5);
      }
    `,
  ],
})
export class LoadingOverlayComponent {
  readonly isLoading = input<boolean>(false);
}
