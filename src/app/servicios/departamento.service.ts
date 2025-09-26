import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { Departamento } from '../interfaces/departamento';

@Injectable({
  providedIn: 'root'
})
export class DepartamentoService {
  private _departamentoData = new BehaviorSubject<Departamento[]>([]);
  private _isLoading = new BehaviorSubject<boolean>(false);
  private _error = new BehaviorSubject<string | null>(null);

  public departamentoData$: Observable<Departamento[]> = this._departamentoData.asObservable();
  public isLoading$: Observable<boolean> = this._isLoading.asObservable();
  public error$: Observable<string | null> = this._error.asObservable();

  constructor() {
  }

  get currentData(): Departamento[] {
    return this._departamentoData.value;
  }

  get isLoading(): boolean {
    return this._isLoading.value;
  }

  get hasError(): boolean {
    return this._error.value !== null;
  }

  async loadDepartamentoData(): Promise<void> {
    this._isLoading.next(true);
    this._error.next(null);

    try {
      if (!window.academicoAPI?.getAllDepartamento) {
        throw new Error('academicoAPI.getAllDepartamento not available');
      }

      const data = await window.academicoAPI.getAllDepartamento();
      
      this._departamentoData.next(data);
      
    } catch (error) {
      const errorMessage = `Error loading departamento data: ${error}`;
      console.error(errorMessage);
      this._error.next(errorMessage);
      this._departamentoData.next([]);
    } finally {
      this._isLoading.next(false);
    }
  }

  async refreshData(): Promise<void> {
    await this.loadDepartamentoData();
  }

  getDepartamentoById(id: string): Departamento | undefined {
    return this.currentData.find(item => item.id === id);
  }

  reset(): void {
    this._departamentoData.next([]);
    this._isLoading.next(false);
    this._error.next(null);
  }
}