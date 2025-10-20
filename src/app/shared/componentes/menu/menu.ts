import { Component, inject, OnInit } from '@angular/core';
import { RouterLink } from '@angular/router';
import { CommonModule } from '@angular/common';
import { AuthService } from '../../../auth/servicios/auth';

@Component({
  selector: 'app-menu',
  imports: [RouterLink, CommonModule],
  templateUrl: './menu.html',
  styleUrl: './menu.scss'
})
export class Menu implements OnInit {
  authService = inject(AuthService);
  isAdmin: boolean = false;
  isFirstLevel: boolean = true;
  tipoMenu: string = '';
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

  irAMenuSecundario(tipo: string) {
    this.isFirstLevel = false;
    this.tipoMenu = tipo;
  }

  volverAMenuPrincipal() {
    this.isFirstLevel = true;
    this.tipoMenu = '';
  }
}
