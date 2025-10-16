import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { Beneficio } from '../interfaces/beneficio';

@Injectable({
  providedIn: 'root'
})
export class BeneficioService {
  private _beneficioData = new BehaviorSubject<Beneficio[]>([]);
  private _isLoading = new BehaviorSubject<boolean>(false);
  private _error = new BehaviorSubject<string | null>(null);

  public beneficioData$: Observable<Beneficio[]> = this._beneficioData.asObservable();
  public isLoading$: Observable<boolean> = this._isLoading.asObservable();
  public error$: Observable<string | null> = this._error.asObservable();

  constructor() {
  }

  get currentData(): Beneficio[] {
    return this._beneficioData.value;
  }

  get isLoading(): boolean {
    return this._isLoading.value;
  }

  get hasError(): boolean {
    return this._error.value !== null;
  }

  async loadBeneficioData(): Promise<void> {
    this._isLoading.next(true);
    this._error.next(null);

    try {
      if (!window.academicoAPI?.getAllBeneficio) {
        throw new Error('academicoAPI.getAllBeneficio not available');
      }

      const data = await window.academicoAPI.getAllBeneficio();

      this._beneficioData.next(data);

    } catch (error) {
      const errorMessage = `Error loading beneficio data: ${error}`;
      console.error(errorMessage);
      this._error.next(errorMessage);
      this._beneficioData.next([]);
    } finally {
      this._isLoading.next(false);
    }
  }

  async refreshData(): Promise<void> {
    await this.loadBeneficioData();
  }

  getBeneficioById(id: string): Beneficio | undefined {
    return this.currentData.find(item => item.id === id);
  }

  /**
   * Obtiene el ID del beneficio "APOYO FAMILIAR"
   * @returns ID del beneficio o undefined si no se encuentra
   */
  getApoyoFamiliarId(): string | undefined {
    const apoyoFamiliar = this.currentData.find(
      item => item.nombre.toUpperCase() === 'APOYO FAMILIAR'
    );
    return apoyoFamiliar?.id;
  }

  reset(): void {
    this._beneficioData.next([]);
    this._isLoading.next(false);
    this._error.next(null);
  }
}
