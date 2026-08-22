import { inject } from '@angular/core';
import { CanActivateFn, CanActivateChildFn, Router } from '@angular/router';
import { AuthService } from './auth.service';

export const authGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);

  if (auth.isAuthenticated()) {
    return true;
  }
  return router.createUrlTree(['/login']);
};

export const authGuardChild: CanActivateChildFn = () => authGuard(null as never, null as never);

/**
 * Permission guard factory.
 *
 * Usage in routes:
 *   canActivate: [permissionGuard('departments.read')]
 */
export function permissionGuard(permission: string | string[]): CanActivateFn {
  return () => {
    const auth = inject(AuthService);
    const router = inject(Router);

    if (!auth.isAuthenticated()) {
      return router.createUrlTree(['/login']);
    }

    const permissions = Array.isArray(permission) ? permission : [permission];
    const hasAccess = auth.hasAnyPermission(permissions);

    if (!hasAccess) {
      router.navigate(['/forbidden']);
      return false;
    }
    return true;
  };
}
