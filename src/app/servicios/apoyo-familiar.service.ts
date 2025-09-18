import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { ApoyoFamiliar } from '../interfaces/apoyo-familiar';

@Injectable({
  providedIn: 'root'
})
export class ApoyoFamiliarService {
  private _apoyoFamiliarData = new BehaviorSubject<ApoyoFamiliar[]>([]);
  private _isLoading = new BehaviorSubject<boolean>(false);
  private _error = new BehaviorSubject<string | null>(null);

  // Observables públicos para que los componentes puedan suscribirse
  public apoyoFamiliarData$: Observable<ApoyoFamiliar[]> = this._apoyoFamiliarData.asObservable();
  public isLoading$: Observable<boolean> = this._isLoading.asObservable();
  public error$: Observable<string | null> = this._error.asObservable();

  constructor() {
    console.log('ApoyoFamiliarService initialized');
  }

  // Getter para acceso directo a los datos actuales
  get currentData(): ApoyoFamiliar[] {
    return this._apoyoFamiliarData.value;
  }

  get isLoading(): boolean {
    return this._isLoading.value;
  }

  get hasError(): boolean {
    return this._error.value !== null;
  }

  // Método para cargar los datos de apoyo familiar
  async loadApoyoFamiliarData(): Promise<void> {
    this._isLoading.next(true);
    this._error.next(null);

    try {
      // Verificar que la API esté disponible
      if (!window.academicoAPI?.getAllApoyoFamiliar) {
        throw new Error('academicoAPI.getAllApoyoFamiliar not available');
      }

      console.log('Loading apoyo familiar data...');
      const data = await window.academicoAPI.getAllApoyoFamiliar();
      
      // Ordenar por el campo 'orden' para mantener consistencia
      const sortedData = data.sort((a: ApoyoFamiliar, b: ApoyoFamiliar) => a.orden - b.orden);
      
      this._apoyoFamiliarData.next(sortedData);
      
    } catch (error) {
      const errorMessage = `Error loading apoyo familiar data: ${error}`;
      console.error(errorMessage);
      this._error.next(errorMessage);
      this._apoyoFamiliarData.next([]); // Reset to empty array on error
    } finally {
      this._isLoading.next(false);
    }
  }

  // Método para refrescar los datos
  async refreshData(): Promise<void> {
    console.log('Refreshing apoyo familiar data...');
    await this.loadApoyoFamiliarData();
  }

  // Método para obtener un apoyo familiar específico por ID
  getApoyoFamiliarById(id: string): ApoyoFamiliar | undefined {
    return this.currentData.find(item => item.id === id);
  }

  // Método para obtener un apoyo familiar por orden
  getApoyoFamiliarByOrden(orden: number): ApoyoFamiliar | undefined {
    return this.currentData.find(item => item.orden === orden);
  }

  // Método para obtener todos los porcentajes ordenados
  getAllPorcentajes(): number[] {
    return this.currentData.map(item => item.porcentaje);
  }

  // Método para reset del servicio (útil para testing o reinicios)
  reset(): void {
    this._apoyoFamiliarData.next([]);
    this._isLoading.next(false);
    this._error.next(null);
  }
}