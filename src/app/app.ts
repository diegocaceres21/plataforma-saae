import { Component, inject, signal, OnInit } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { Loading } from "./componentes/shared/loading/loading";
import { LoadingService } from './servicios/loading';
import { ApoyoFamiliarService } from './servicios/apoyo-familiar.service';
import { TarifarioService } from './servicios/tarifario.service';
import { DepartamentoService } from './servicios/departamento.service';
import { CarreraService } from './servicios/carrera.service';
import { AsyncPipe } from '@angular/common';
import './interfaces/electron-api'; // Import electron API types

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, Loading, AsyncPipe],
  templateUrl: './app.html',
  styleUrl: './app.scss'
})
export class App implements OnInit {
  public loadingService = inject(LoadingService);
  private apoyoFamiliarService = inject(ApoyoFamiliarService);
  private tarifarioService = inject(TarifarioService);
  private departamentoService = inject(DepartamentoService);
  private carreraService = inject(CarreraService);

  async ngOnInit() {
    console.log('App initializing...');
    
    // Initialize global data when the app starts
    // Load departamento and tarifario first, then carrera (which depends on them)
    try {
      // Load independent data first
      await Promise.all([
        this.apoyoFamiliarService.loadApoyoFamiliarData(),
        this.tarifarioService.loadTarifarioData(),
        this.departamentoService.loadDepartamentoData()
      ]);
      
      // Load carrera data after departamento and tarifario are loaded
      await this.carreraService.loadCarreraData();
      
      console.log('App initialization completed successfully');
    } catch (error) {
      console.error('Error during app initialization:', error);
      // App continues to work even if some services fail
    }
  }
}
