import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';

export const authGuard: CanActivateFn = () => {
  const router = inject(Router);
  const isLoggedIn = Boolean(localStorage.getItem('stms.token'));

  if (isLoggedIn) {
    return router.createUrlTree(['/dashboard']);
  }

  return router.createUrlTree(['/homepage']);
};
