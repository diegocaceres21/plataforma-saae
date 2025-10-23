import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { Gestion } from '../interfaces/gestion';

@Injectable({
  providedIn: 'root'
})
export class GestionService {
  private _gestionData = new BehaviorSubject<Gestion[]>([]);
  private _isLoading = new BehaviorSubject<boolean>(false);
  private _error = new BehaviorSubject<string | null>(null);

  public gestionData$: Observable<Gestion[]> = this._gestionData.asObservable();
  public isLoading$: Observable<boolean> = this._isLoading.asObservable();
  public error$: Observable<string | null> = this._error.asObservable();

  constructor() {}

  get currentData(): Gestion[] {
    // Ordenar por orden (asc) y luego por anio (desc) si aplica
    return [...this._gestionData.value].sort((a, b) => {
      if (a.anio !== b.anio) return b.anio - a.anio;
      return a.gestion.localeCompare(b.gestion, 'es', { sensitivity: 'base' });
    });
  }

  get gestionesActivas(): Gestion[] {
    // Ordenar por orden (asc) y luego por anio (desc) si aplica
    return [...this._gestionData.value].sort((a, b) => {
      if (a.anio !== b.anio) return b.anio - a.anio;
      return a.gestion.localeCompare(b.gestion, 'es', { sensitivity: 'base' });
    })
    .filter(g => g.activo);
  }

  get isLoading(): boolean {
    return this._isLoading.value;
  }

  get hasError(): boolean {
    return this._error.value !== null;
  }

  async loadGestionData(): Promise<void> {
    this._isLoading.next(true);
    this._error.next(null);

    try {
      if (!window.academicoAPI?.getAllVisibleGestion) {
        throw new Error('academicoAPI.getAllVisibleGestion not available');
      }

      const data: Gestion[] = await window.academicoAPI.getAllVisibleGestion();
      this._gestionData.next(Array.isArray(data) ? data : []);
    } catch (error) {
      const errorMessage = `Error loading gestion data: ${error}`;
      console.error(errorMessage);
      this._error.next(errorMessage);
      this._gestionData.next([]);
    } finally {
      this._isLoading.next(false);
    }
  }

  async refreshData(): Promise<void> {
    await this.loadGestionData();
  }

  getGestionById(id: string): Gestion | undefined {
    return this.currentData.find(g => g.id === id);
  }

  getActiveGestiones(): Gestion[] {
    return this.currentData.filter(g => g.activo);
  }

  reset(): void {
    this._gestionData.next([]);
    this._isLoading.next(false);
    this._error.next(null);
  }
}
