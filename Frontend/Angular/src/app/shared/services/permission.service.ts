import { Injectable, computed, inject } from '@angular/core';
import { AuthService } from '../../core/auth/auth.service';

@Injectable({ providedIn: 'root' })
export class PermissionService {
  private readonly auth = inject(AuthService);

  can(permission: string): boolean {
    return this.auth.hasPermission(permission);
  }

  canAny(permissions: string[]): boolean {
    return this.auth.hasAnyPermission(permissions);
  }

  canAll(permissions: string[]): boolean {
    return this.auth.hasAllPermissions(permissions);
  }

  isInRole(role: string): boolean {
    return this.auth.hasRole(role);
  }
}
