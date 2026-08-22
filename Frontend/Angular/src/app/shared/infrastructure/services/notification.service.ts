import { Injectable } from '@angular/core';
import { Subject } from 'rxjs';

export interface Notification {
  id: string;
  message: string;
  type: 'success' | 'error' | 'warning' | 'info';
  duration?: number;
}

/**
 * Notification service for toast/snackbar messages
 */
@Injectable({ providedIn: 'root' })
export class NotificationService {
  private notifications$ = new Subject<Notification>();

  getNotifications() {
    return this.notifications$.asObservable();
  }

  success(message: string, duration?: number): void {
    this.notify({ message, type: 'success', duration });
  }

  error(message: string, duration?: number): void {
    this.notify({ message, type: 'error', duration });
  }

  warning(message: string, duration?: number): void {
    this.notify({ message, type: 'warning', duration });
  }

  info(message: string, duration?: number): void {
    this.notify({ message, type: 'info', duration });
  }

  private notify(notification: Omit<Notification, 'id'>): void {
    const id = `notif-${Date.now()}-${Math.random()}`;
    this.notifications$.next({ ...notification, id } as Notification);
  }
}
