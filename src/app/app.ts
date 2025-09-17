import { Component, inject, signal, OnInit } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { Loading } from "./componentes/shared/loading/loading";
import { LoadingService } from './servicios/loading';
import { ApoyoFamiliarService } from './servicios/apoyo-familiar.service';
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

  async ngOnInit() {
    console.log('App initializing...');
    
    // Initialize apoyo familiar data when the app starts
    try {
      await this.apoyoFamiliarService.loadApoyoFamiliarData();
      console.log('App initialization completed successfully');
    } catch (error) {
      console.error('Error during app initialization:', error);
      // App continues to work even if this fails
    }
  }
}
