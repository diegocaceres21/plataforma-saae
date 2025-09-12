import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class LoadingService {
  private loadingSubject = new BehaviorSubject<boolean>(false);
  private loadingCount = 0;

  public loading$ = this.loadingSubject.asObservable();

  /**
   * Mostrar loading
   */
  show(): void {
    this.loadingCount++;
    if (this.loadingCount === 1) {
      this.loadingSubject.next(true);
    }
  }

  /**
   * Ocultar loading
   */
  hide(): void {
    this.loadingCount--;
    if (this.loadingCount <= 0) {
      this.loadingCount = 0;
      this.loadingSubject.next(false);
    }
  }

  /**
   * Obtener estado actual
   */
  isLoading(): boolean {
    return this.loadingSubject.value;
  }

  /**
   * Forzar estado de loading
   */
  setLoading(loading: boolean): void {
    this.loadingCount = loading ? 1 : 0;
    this.loadingSubject.next(loading);
  }
}
