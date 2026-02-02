import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { Asignatura } from '../interfaces/asignatura';

@Injectable({
  providedIn: 'root'
})
export class OfertaAcademica {
  private _asignaturas = new BehaviorSubject<Asignatura[]>([]);
  private _isLoading = new BehaviorSubject<boolean>(false);
  private _error = new BehaviorSubject<string | null>(null);
  
  public asignaturas$: Observable<Asignatura[]> = this._asignaturas.asObservable();
  public isLoading$: Observable<boolean> = this._isLoading.asObservable();
  public error$: Observable<string | null> = this._error.asObservable();

  constructor() { }

  get currentData(): Asignatura[] {
    return this._asignaturas.value;
  }
  
  get isLoading(): boolean {
    return this._isLoading.value;
  }
  
  get hasError(): boolean {
    return this._error.value !== null;
  }

  async loadAsignaturasData(): Promise<void> {
    this._isLoading.next(true);
    this._error.next(null);
    console.log('Cargando datos de asignaturas desde oferta académica...');
    try {
      if (!window.academicoAPI?.obtenerAsignaturas) {
        throw new Error('academicoAPI.obtenerAsignaturas not available');
      }

      const data = await window.academicoAPI.obtenerAsignaturas();

      this._asignaturas.next(data);
      console.log('Datos de asignaturas cargados:', data);

    } catch (error) {
      const errorMessage = `Error loading asignaturas data: ${error}`;
      console.error(errorMessage);
      this._error.next(errorMessage);
      this._asignaturas.next([]);
    } finally {
      this._isLoading.next(false);
    }
  }
}
