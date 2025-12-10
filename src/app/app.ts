import { Component, inject, signal, OnInit } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { Loading } from "./shared/componentes/loading/loading";
import { LoadingService } from './shared/servicios/loading';
// Data services are preloaded via APP_INITIALIZER
import { AsyncPipe } from '@angular/common';
import './shared/interfaces/electron-api'; // Import electron API types

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, Loading, AsyncPipe],
  templateUrl: './app.html',
  styleUrl: './app.scss'
})
export class App implements OnInit {
  public loadingService = inject(LoadingService);
  
  async ngOnInit() {
    // All base data loads are handled in APP_INITIALIZER now.
  }
}
