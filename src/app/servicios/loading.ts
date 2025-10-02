import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class LoadingService {
  private loadingSubject = new BehaviorSubject<boolean>(false);
  private messageSubject = new BehaviorSubject<string>('Cargando...');
  private loadingCount = 0;

  public loading$ = this.loadingSubject.asObservable();
  public message$ = this.messageSubject.asObservable();

  /**
   * Mostrar loading con mensaje opcional
   */
  show(message?: string): void {
    this.loadingCount++;
    if (message) {
      this.messageSubject.next(message);
    }
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
      // Reset message to default
      this.messageSubject.next('Cargando...');
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
  setLoading(loading: boolean, message?: string): void {
    this.loadingCount = loading ? 1 : 0;
    this.loadingSubject.next(loading);
    if (message) {
      this.messageSubject.next(message);
    } else if (!loading) {
      this.messageSubject.next('Cargando...');
    }
  }
}
