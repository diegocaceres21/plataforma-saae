import { Component, inject, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ApoyoFamiliarService } from '../../servicios/apoyo-familiar.service';
import { ApoyoFamiliar } from '../../interfaces/apoyo-familiar';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-apoyo-familiar-example',
  imports: [CommonModule],
  template: `
    <div class="p-6 bg-white rounded-lg shadow-lg">
      <h2 class="text-2xl font-bold mb-4">Datos de Apoyo Familiar</h2>
      
      <!-- Loading state -->
      @if (apoyoFamiliarService.isLoading$ | async) {
        <div class="flex items-center justify-center p-8">
          <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
          <span class="ml-3 text-gray-600">Cargando datos de apoyo familiar...</span>
        </div>
      }
      
      <!-- Error state -->
      @if (apoyoFamiliarService.error$ | async; as error) {
        <div class="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
          <strong>Error:</strong> {{error}}
          <button 
            (click)="refreshData()" 
            class="ml-4 bg-red-500 hover:bg-red-700 text-white font-bold py-1 px-2 rounded text-sm">
            Reintentar
          </button>
        </div>
      }
      
      <!-- Data display -->
      @if (apoyoFamiliarData.length > 0) {
        <div class="space-y-4">
          <div class="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded mb-4">
            <strong>✅ Datos cargados exitosamente!</strong> 
            Se encontraron {{apoyoFamiliarData.length}} registros de apoyo familiar.
          </div>
          
          <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            @for (item of apoyoFamiliarData; track item.id) {
              <div class="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div class="text-sm text-gray-600">ID: {{item.id}}</div>
                <div class="text-lg font-semibold text-blue-800">{{item.porcentaje}}%</div>
                <div class="text-sm text-gray-600">Orden: {{item.orden}}</div>
              </div>
            }
          </div>
          
          <!-- Quick stats -->
          <div class="mt-6 p-4 bg-gray-50 rounded-lg">
            <h3 class="text-lg font-semibold mb-2">Estadísticas rápidas:</h3>
            <div class="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span class="font-medium">Total de registros:</span> 
                {{apoyoFamiliarData.length}}
              </div>
              <div>
                <span class="font-medium">Porcentajes disponibles:</span> 
                {{getAllPorcentajes().join(', ')}}%
              </div>
            </div>
          </div>
          
          <!-- Action buttons -->
          <div class="flex gap-2 mt-4">
            <button 
              (click)="refreshData()" 
              class="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded">
              Refrescar Datos
            </button>
            <button 
              (click)="logCurrentData()" 
              class="bg-gray-500 hover:bg-gray-700 text-white font-bold py-2 px-4 rounded">
              Log en Consola
            </button>
          </div>
        </div>
      } @else if (!(apoyoFamiliarService.isLoading$ | async) && !(apoyoFamiliarService.error$ | async)) {
        <div class="text-center p-8 text-gray-500">
          <div class="text-4xl mb-4">📋</div>
          <p>No hay datos de apoyo familiar disponibles</p>
          <button 
            (click)="refreshData()" 
            class="mt-4 bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded">
            Cargar Datos
          </button>
        </div>
      }
    </div>
  `,
  standalone: true
})
export class ApoyoFamiliarExampleComponent implements OnInit, OnDestroy {
  public apoyoFamiliarService = inject(ApoyoFamiliarService);
  public apoyoFamiliarData: ApoyoFamiliar[] = [];
  
  private subscription = new Subscription();

  ngOnInit() {
    // Subscribe to the apoyo familiar data changes
    this.subscription.add(
      this.apoyoFamiliarService.apoyoFamiliarData$.subscribe(data => {
        this.apoyoFamiliarData = data;
        console.log('Component received updated apoyo familiar data:', data);
      })
    );
  }

  ngOnDestroy() {
    this.subscription.unsubscribe();
  }

  async refreshData() {
    console.log('Refreshing apoyo familiar data from component...');
    await this.apoyoFamiliarService.refreshData();
  }

  logCurrentData() {
    console.log('Current apoyo familiar data:', this.apoyoFamiliarService.currentData);
    console.log('Service status - Loading:', this.apoyoFamiliarService.isLoading, 'Has Error:', this.apoyoFamiliarService.hasError);
  }

  getAllPorcentajes(): number[] {
    return this.apoyoFamiliarService.getAllPorcentajes();
  }

  // Example methods to demonstrate service usage
  getApoyoFamiliarById(id: string): ApoyoFamiliar | undefined {
    return this.apoyoFamiliarService.getApoyoFamiliarById(id);
  }

  getApoyoFamiliarByOrden(orden: number): ApoyoFamiliar | undefined {
    return this.apoyoFamiliarService.getApoyoFamiliarByOrden(orden);
  }
}