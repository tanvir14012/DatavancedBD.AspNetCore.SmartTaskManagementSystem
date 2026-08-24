import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';

export const taskBoardGuard: CanActivateFn = () => {
  const authService = inject(AuthService);
  const router = inject(Router);
  const role = authService.currentUser()?.role ?? '';

  const canAccess = role === 'Admin' || role === 'Project Manager';
  return canAccess ? true : router.createUrlTree(['/tasks']);
};
