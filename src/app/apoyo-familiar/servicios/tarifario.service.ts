import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { Tarifario } from '../interfaces/tarifario';

@Injectable({
  providedIn: 'root'
})
export class TarifarioService {
  private _tarifarioData = new BehaviorSubject<Tarifario[]>([]);
  private _isLoading = new BehaviorSubject<boolean>(false);
  private _error = new BehaviorSubject<string | null>(null);

  public tarifarioData$: Observable<Tarifario[]> = this._tarifarioData.asObservable();
  public isLoading$: Observable<boolean> = this._isLoading.asObservable();
  public error$: Observable<string | null> = this._error.asObservable();

  constructor() {  }

  get currentData(): Tarifario[] {
    return this._tarifarioData.value;
  }

  get isLoading(): boolean {
    return this._isLoading.value;
  }

  get hasError(): boolean {
    return this._error.value !== null;
  }

  async loadTarifarioData(): Promise<void> {
    this._isLoading.next(true);
    this._error.next(null);

    try {
      if (!window.academicoAPI?.getAllVisibleTarifario) {
        throw new Error('academicoAPI.getAllVisibleTarifario not available');
      }

      const data = await window.academicoAPI.getAllVisibleTarifario();

      this._tarifarioData.next(data);

    } catch (error) {
      const errorMessage = `Error loading tarifario data: ${error}`;
      console.error(errorMessage);
      this._error.next(errorMessage);
      this._tarifarioData.next([]);
    } finally {
      this._isLoading.next(false);
    }
  }

  async refreshData(): Promise<void> {
    await this.loadTarifarioData();
  }

  getTarifarioById(id: string): Tarifario | undefined {
    return this.currentData.find(item => item.id === id);
  }

  reset(): void {
    this._tarifarioData.next([]);
    this._isLoading.next(false);
    this._error.next(null);
  }
}
