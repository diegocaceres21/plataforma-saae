import { Injectable } from '@angular/core';
import { CanActivate, Router } from '@angular/router';
import { AuthService } from './auth';

@Injectable({
  providedIn: 'root'
})
export class AdminGuard implements CanActivate {
  constructor(private authService: AuthService, private router: Router) {}

  async canActivate(): Promise<boolean> {
    // Primero verificar si está autenticado
    if (!this.authService.isAuthenticated()) {
      this.router.navigate(['/login']);
      return false;
    }

    // Verificar con el servidor
    const serverValid = await this.authService.verifyServer();
    if (!serverValid) {
      this.router.navigate(['/login']);
      return false;
    }

    // Verificar rol admin
    const auth = this.authService.getAuth();
    if (!auth || auth.user.rol !== 'admin') {
      this.router.navigate(['/menu']); // Redirigir al menú principal si no es admin
      return false;
    }

    return true;
  }
}