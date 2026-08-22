import { Injectable, inject } from '@angular/core';
import { MatSnackBar, MatSnackBarConfig } from '@angular/material/snack-bar';
import { TranslateService } from '@ngx-translate/core';

@Injectable({ providedIn: 'root' })
export class NotificationService {
  private readonly snackBar = inject(MatSnackBar);
  private readonly translate = inject(TranslateService);

  private show(messageKey: string, panelClass: string, params?: object): void {
    const message = this.translate.instant(messageKey, params);
    const action = this.translate.instant('common.close');
    const config: MatSnackBarConfig = {
      duration: 4000,
      panelClass: [panelClass],
      horizontalPosition: 'end',
      verticalPosition: 'top',
    };
    this.snackBar.open(message, action, config);
  }

  success(messageKey: string, params?: object): void {
    this.show(messageKey, 'snackbar-success', params);
  }

  error(messageKey: string, params?: object): void {
    this.show(messageKey, 'snackbar-error', params);
  }

  info(messageKey: string, params?: object): void {
    this.show(messageKey, 'snackbar-info', params);
  }

  warn(messageKey: string, params?: object): void {
    this.show(messageKey, 'snackbar-warn', params);
  }
}
