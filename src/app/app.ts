import { Component, inject, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { Loading } from "./componentes/shared/loading/loading";
import { LoadingService } from './servicios/loading';
import { AsyncPipe } from '@angular/common';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, Loading, AsyncPipe],
  templateUrl: './app.html',
  styleUrl: './app.scss'
})
export class App {
  public loadingService = inject(LoadingService);
}
