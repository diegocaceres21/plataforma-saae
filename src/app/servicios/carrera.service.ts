import { Injectable, inject } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { Carrera, CarreraWithRelations } from '../interfaces/carrera';
import { DepartamentoService } from './departamento.service';
import { TarifarioService } from './tarifario.service';

@Injectable({
  providedIn: 'root'
})
export class CarreraService {
  private _carreraData = new BehaviorSubject<CarreraWithRelations[]>([]);
  private _isLoading = new BehaviorSubject<boolean>(false);
  private _error = new BehaviorSubject<string | null>(null);

  public carreraData$: Observable<CarreraWithRelations[]> = this._carreraData.asObservable();
  public isLoading$: Observable<boolean> = this._isLoading.asObservable();
  public error$: Observable<string | null> = this._error.asObservable();

  private departamentoService = inject(DepartamentoService);
  private tarifarioService = inject(TarifarioService);

  constructor() {
  }

  get currentData(): CarreraWithRelations[] {
    return this._carreraData.value.sort((a, b) => 
      a.carrera.localeCompare(b.carrera, 'es', { sensitivity: 'base' })
    );
  }

  get isLoading(): boolean {
    return this._isLoading.value;
  }

  get hasError(): boolean {
    return this._error.value !== null;
  }

  async loadCarreraData(): Promise<void> {
    this._isLoading.next(true);
    this._error.next(null);

    try {
      if (!window.academicoAPI?.getAllCarrera) {
        throw new Error('academicoAPI.getAllCarrera not available');
      }

      const carreraData: Carrera[] = await window.academicoAPI.getAllCarrera();
      
      // Join with departamento and tarifario data
      const carrerasWithRelations: CarreraWithRelations[] = carreraData.map(carrera => {
        const departamento = this.departamentoService.getDepartamentoById(carrera.id_departamento);
        const tarifario = this.tarifarioService.getTarifarioById(carrera.id_tarifario);
        
        return {
          ...carrera,
          departamento: departamento ? {
            id: departamento.id,
            departamento: departamento.departamento
          } : undefined,
          tarifario: tarifario ? {
            id: tarifario.id,
            tarifario: tarifario.tarifario,
            valor_credito: tarifario.valor_credito,
            created_at: tarifario.created_at,
            updated_at: tarifario.updated_at
          } : undefined
        };
      });
      
      this._carreraData.next(carrerasWithRelations);
      
    } catch (error) {
      const errorMessage = `Error loading carrera data: ${error}`;
      console.error(errorMessage);
      this._error.next(errorMessage);
      this._carreraData.next([]);
    } finally {
      this._isLoading.next(false);
    }
  }

  async refreshData(): Promise<void> {
    await this.loadCarreraData();
  }

  getCarreraById(id: string): CarreraWithRelations | undefined {
    return this.currentData.find(item => item.id === id);
  }

  getCarrerasByDepartamento(id_departamento: string): CarreraWithRelations[] {
    return this.currentData.filter(item => item.id_departamento === id_departamento);
  }

  getCarrerasByTarifario(id_tarifario: string): CarreraWithRelations[] {
    return this.currentData.filter(item => item.id_tarifario === id_tarifario);
  }

  reset(): void {
    this._carreraData.next([]);
    this._isLoading.next(false);
    this._error.next(null);
  }
}