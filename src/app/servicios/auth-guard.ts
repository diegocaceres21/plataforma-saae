import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from './auth';

export const authGuard: CanActivateFn = async () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  if (auth.isAuthenticated()) {
    // Validación opcional con backend (silenciosa)
    auth.verifyServer();
    return true;
  }
  await router.navigate(['/login']);
  return false;
};
