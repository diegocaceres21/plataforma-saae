import { Component, inject } from '@angular/core';
import { AuthService } from '../../../auth/servicios/auth';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-main-menu',
  imports: [RouterLink],
  templateUrl: './main-menu.html',
  styleUrl: './main-menu.scss'
})
export class MainMenu {
  authService = inject(AuthService);

  isAdmin: boolean = false;
  userName: string = '';

  ngOnInit() {
    this.isAdmin = this.authService.isAdmin();
    const user = this.authService.getUser();
    this.userName = user ? user.nombre || user.username : '';
  }

  logout() {
    this.authService.logout();
    window.location.href = '/login';
  }
}
