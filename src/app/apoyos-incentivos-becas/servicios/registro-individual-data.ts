import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { RegistroEstudiante } from '../interfaces/registro-estudiante';

export type ViewState = 'registro' | 'vista';

@Injectable({
  providedIn: 'root'
})
export class RegistroIndividualDataService {

  // Estado de la vista actual
  private currentViewSubject = new BehaviorSubject<ViewState>('registro');
  public currentView$ = this.currentViewSubject.asObservable();

  // Datos de los estudiantes registrados
  private registrosEstudiantesSubject = new BehaviorSubject<Partial<RegistroEstudiante>[]>([]);
  public registrosEstudiantes$ = this.registrosEstudiantesSubject.asObservable();

  // Estado de si hay datos válidos
  private hasValidDataSubject = new BehaviorSubject<boolean>(false);
  public hasValidData$ = this.hasValidDataSubject.asObservable();

  constructor() {}

  // Getters para acceso directo a los valores actuales
  get currentView(): ViewState {
    return this.currentViewSubject.value;
  }

  get registrosEstudiantes(): Partial<RegistroEstudiante>[] {
    return this.registrosEstudiantesSubject.value;
  }

  get hasValidData(): boolean {
    return this.hasValidDataSubject.value;
  }

  // Navegar a la vista de registro
  navigateToRegistro(): void {
    this.currentViewSubject.next('registro');
  }

  // Navegar a la vista de resultados
  navigateToVista(): void {
    this.currentViewSubject.next('vista');
  }

  // Actualizar los datos de estudiantes y navegar a vista
  setRegistrosAndNavigate(registros: Partial<RegistroEstudiante>[]): void {
    this.registrosEstudiantesSubject.next([...registros]); // Crear copia para evitar mutaciones
    this.hasValidDataSubject.next(registros.length > 0);
    this.navigateToVista();
  }

  // Actualizar solo los datos sin navegar
  updateRegistros(registros: Partial<RegistroEstudiante>[]): void {
    this.registrosEstudiantesSubject.next([...registros]);
    this.hasValidDataSubject.next(registros.length > 0);
  }

  // Limpiar todos los datos
  clearData(): void {
    this.registrosEstudiantesSubject.next([]);
    this.hasValidDataSubject.next(false);
    this.navigateToRegistro();
  }

  // Resetear solo la vista sin limpiar datos
  resetView(): void {
    this.navigateToRegistro();
  }
}
