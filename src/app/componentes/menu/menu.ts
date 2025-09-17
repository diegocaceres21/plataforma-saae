import { Component, inject, OnInit } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ApoyoFamiliarService } from '../../servicios/apoyo-familiar.service';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-menu',
  imports: [RouterLink, CommonModule],
  templateUrl: './menu.html',
  styleUrl: './menu.scss'
})
export class Menu implements OnInit {
  private apoyoFamiliarService = inject(ApoyoFamiliarService);
  
  // Exponer el servicio para uso en el template
  get apoyoFamiliarData() {
    return this.apoyoFamiliarService.currentData;
  }
  
  get apoyoFamiliarCount() {
    return this.apoyoFamiliarService.currentData.length;
  }

  ngOnInit() {
    // Ejemplo de uso: log de los datos cuando el componente se inicializa
    console.log('Menu component - Apoyo Familiar data available:', this.apoyoFamiliarData);
  }
}
