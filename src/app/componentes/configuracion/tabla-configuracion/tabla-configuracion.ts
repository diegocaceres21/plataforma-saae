import { Component, Input, Output, EventEmitter, OnInit, OnDestroy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ConfiguracionService, ConfigurationItem } from '../../../servicios/configuracion';
import { Subject, takeUntil } from 'rxjs';

interface AccionTabla {
  nombre: string;
  icono: string;
  clase: string;
  habilitada: boolean;
  mostrar: boolean;
}

@Component({
  selector: 'app-tabla-configuracion',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="bg-gray-50 rounded-xl p-6 border border-gray-100">
      <!-- Header de tabla con botón agregar -->
      <div class="flex justify-between items-center mb-6">
        <div class="flex items-center space-x-3">
          <h3 class="text-lg font-semibold text-gray-900">{{ titulo }}</h3>
          @if (datos.length > 0) {
            <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
              {{ datos.length }} {{ datos.length === 1 ? 'elemento' : 'elementos' }}
            </span>
          }
        </div>
        @if (puedeCrear) {
          <button
            (click)="nuevoItem()"
            [disabled]="deshabilitarAcciones"
            class="inline-flex items-center px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 
                   text-white font-medium text-sm rounded-lg transition-colors duration-200 shadow-sm">
            <svg class="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"></path>
            </svg>
            Agregar {{ nombreSingular }}
          </button>
        }
      </div>

      <!-- Estado de carga -->
      @if (cargando) {
        <div class="flex flex-col items-center justify-center py-16 text-gray-600">
          <div class="h-8 w-8 border-4 border-gray-300 border-t-blue-600 rounded-full animate-spin mb-3"></div>
          <p class="text-sm">Cargando datos...</p>
        </div>
      } @else {
        <!-- Tabla de datos o mensaje vacío -->
        @if (datos.length === 0) {
          <div class="text-center py-12 text-gray-500">
            <svg class="mx-auto h-12 w-12 text-gray-400 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" 
                    d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2 2v-5m16 0h-6m6 0a2 2 0 01-2 2H6a2 2 0 01-2-2V6v7"></path>
            </svg>
            <h3 class="text-sm font-medium text-gray-900 mb-1">No hay datos disponibles</h3>
            <p class="text-sm text-gray-500">No se encontraron {{ titulo.toLowerCase() }} en el sistema.</p>
            @if (puedeCrear) {
              <div class="mt-4">
                <button
                  (click)="nuevoItem()"
                  class="inline-flex items-center px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white 
                         font-medium text-sm rounded-lg transition-colors duration-200">
                  <svg class="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"></path>
                  </svg>
                  Crear primer {{ nombreSingular.toLowerCase() }}
                </button>
              </div>
            }
          </div>
        } @else {
          <!-- Tabla con datos -->
          <div class="bg-white rounded-lg border border-gray-200 overflow-hidden shadow-sm">
            <div class="overflow-x-auto">
              <table class="min-w-full divide-y divide-gray-200">
                <thead class="bg-gray-50">
                  <tr>
                    @for (columna of columnas; track columna) {
                      <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        {{ obtenerNombreColumna(columna) }}
                      </th>
                    }
                    @if (tieneAcciones) {
                      <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Acciones
                      </th>
                    }
                  </tr>
                </thead>
                <tbody class="bg-white divide-y divide-gray-200">
                  @for (item of datos; track item.id) {
                    <tr class="hover:bg-gray-50 transition-colors duration-150">
                      @for (columna of columnas; track columna) {
                        <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {{ formatearValor(item, columna) }}
                        </td>
                      }
                      @if (tieneAcciones) {
                        <td class="px-6 py-4 whitespace-nowrap text-sm font-medium">
                          <div class="flex items-center space-x-3">
                            @if (puedeEditar) {
                              <button
                                (click)="editarItem(item)"
                                [disabled]="deshabilitarAcciones"
                                class="text-blue-600 hover:text-blue-900 disabled:text-gray-400 transition-colors 
                                       inline-flex items-center text-sm font-medium"
                                [title]="'Editar ' + nombreSingular.toLowerCase()">
                                <svg class="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" 
                                        d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"></path>
                                </svg>
                                Editar
                              </button>
                            }
                            
                            @if (puedeEliminar) {
                              <button
                                (click)="confirmarEliminar(item)"
                                [disabled]="deshabilitarAcciones"
                                class="text-red-600 hover:text-red-900 disabled:text-gray-400 transition-colors 
                                       inline-flex items-center text-sm font-medium"
                                [title]="'Eliminar ' + nombreSingular.toLowerCase()">
                                <svg class="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" 
                                        d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path>
                                </svg>
                                Eliminar
                              </button>
                            }
                          </div>
                        </td>
                      }
                    </tr>
                  }
                </tbody>
              </table>
            </div>
          </div>
          
          <!-- Footer con información adicional -->
          @if (datos.length > 5) {
            <div class="mt-4 flex justify-between items-center text-sm text-gray-500">
              <div>
                Mostrando {{ datos.length }} {{ datos.length === 1 ? 'resultado' : 'resultados' }}
              </div>
            </div>
          }
        }
      }
    </div>
  `,
  styles: [`
    .table-cell-hover:hover {
      background-color: rgba(59, 130, 246, 0.05);
    }
    
    .action-button:hover {
      transform: translateY(-1px);
    }
    
    .loading-shimmer {
      background: linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%);
      background-size: 200% 100%;
      animation: shimmer 1.5s infinite;
    }
    
    @keyframes shimmer {
      0% { background-position: -200% 0; }
      100% { background-position: 200% 0; }
    }
  `]
})
export class TablaConfiguracionComponent implements OnInit, OnDestroy {
  private configuracionService = inject(ConfiguracionService);
  private destroy$ = new Subject<void>();

  @Output() nuevo = new EventEmitter<void>();
  @Output() editar = new EventEmitter<ConfigurationItem>();
  @Output() eliminar = new EventEmitter<ConfigurationItem>();

  datos: ConfigurationItem[] = [];
  columnas: string[] = [];
  titulo: string = '';
  nombreSingular: string = '';
  cargando: boolean = false;
  deshabilitarAcciones: boolean = false;

  // Permisos
  puedeCrear: boolean = true;
  puedeEditar: boolean = true;
  puedeEliminar: boolean = true;

  get tieneAcciones(): boolean {
    return this.puedeEditar || this.puedeEliminar;
  }

  ngOnInit(): void {
    this.suscribirACambios();
    this.actualizarDatos();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private suscribirACambios(): void {
    // Suscribirse a cambios de tabla activa
    this.configuracionService.tablaActiva$
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => {
        this.actualizarDatos();
      });

    // Suscribirse a cambios de datos
    this.configuracionService.datos$
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => {
        this.actualizarDatos();
      });

    // Suscribirse a cambios de estado de loading
    this.configuracionService.loading$
      .pipe(takeUntil(this.destroy$))
      .subscribe(loading => {
        this.cargando = loading;
      });
  }

  private actualizarDatos(): void {
    const configuracion = this.configuracionService.getConfiguracionTablaActiva();
    if (!configuracion) return;

    this.titulo = configuracion.nombre;
    this.nombreSingular = configuracion.nombreSingular;
    this.columnas = configuracion.campos.map(campo => campo.key);
    this.datos = this.configuracionService.getDatosTablaActiva();

    // Actualizar permisos
    this.puedeCrear = configuracion.permisos.crear;
    this.puedeEditar = configuracion.permisos.editar;
    this.puedeEliminar = configuracion.permisos.eliminar;
  }

  obtenerNombreColumna(columna: string): string {
    return this.configuracionService.obtenerNombreColumna(columna);
  }

  formatearValor(item: any, columna: string): string {
    const valor = this.configuracionService.obtenerValorCampo(item, columna);
    
    if (valor === null || valor === undefined) {
      return '-';
    }

    // Formatear valores booleanos
    if (typeof valor === 'boolean') {
      return valor ? '✓ Sí' : '✗ No';
    }

    // Formatear diferentes tipos de datos
    if (typeof valor === 'number') {
      // Si es un porcentaje (contiene la palabra porcentaje en la columna)
      if (columna.toLowerCase().includes('porcentaje')) {
        return valor * 100 + '%';
      }
      // Si es dinero (contiene valor, precio, etc.)
      if (columna.toLowerCase().includes('valor') || columna.toLowerCase().includes('precio') || columna.toLowerCase().includes('credito')) {
        return new Intl.NumberFormat('es-BO', { 
          style: 'currency', 
          currency: 'BOB' 
        }).format(valor);
      }
      return valor.toString();
    }

    if (typeof valor === 'string') {
      // Formatear fechas
      if (columna.includes('fecha') || columna.includes('_at')) {
        try {
          const fecha = new Date(valor);
          return fecha.toLocaleDateString('es-BO');
        } catch {
          return valor;
        }
      }
      return valor;
    }

    return valor.toString();
  }

  nuevoItem(): void {
    this.nuevo.emit();
  }

  editarItem(item: ConfigurationItem): void {
    this.editar.emit(item);
  }

  confirmarEliminar(item: ConfigurationItem): void {
    const nombreItem = this.obtenerNombreItem(item);
    const mensaje = `¿Está seguro de que desea eliminar ${this.nombreSingular.toLowerCase()} "${nombreItem}"?`;
    
    if (confirm(mensaje)) {
      this.eliminar.emit(item);
    }
  }

  private obtenerNombreItem(item: any): string {
    // Intentar obtener el nombre más representativo del item
    const posiblesCampos = ['nombre', 'carrera', 'departamento', 'gestion', 'apoyo_familiar'];
    
    for (const campo of posiblesCampos) {
      if (item[campo]) {
        return item[campo];
      }
    }

    // Si no encuentra un campo específico, usar el primer campo disponible
    const primerCampo = this.columnas[0];
    return item[primerCampo] || 'elemento';
  }

  // Método para establecer si las acciones deben estar deshabilitadas
  establecerDeshabilitarAcciones(deshabilitar: boolean): void {
    this.deshabilitarAcciones = deshabilitar;
  }
}