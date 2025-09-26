import { Component, OnInit, OnDestroy, inject, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { ToastContainerComponent } from '../shared/toast-container/toast-container';
import { ConfiguracionService, ConfigurationItem } from '../../servicios/configuracion';
import { TabsNavegacionComponent } from './tabs-navegacion/tabs-navegacion';
import { FormularioConfiguracionComponent } from './formulario-configuracion/formulario-configuracion';
import { TablaConfiguracionComponent } from './tabla-configuracion/tabla-configuracion';
import { Subject, takeUntil } from 'rxjs';

@Component({
  selector: 'app-configuracion',
  standalone: true,
  imports: [
    CommonModule, 
    RouterModule, 
    ToastContainerComponent,
    TabsNavegacionComponent,
    FormularioConfiguracionComponent,
    TablaConfiguracionComponent
  ],
  templateUrl: './configuracion.html',
  styleUrls: ['./configuracion.scss'],
})
export class ConfiguracionComponent implements OnInit, OnDestroy {
  private router = inject(Router);
  private configuracionService = inject(ConfiguracionService);
  private destroy$ = new Subject<void>();

  @ViewChild(FormularioConfiguracionComponent) formularioComponent!: FormularioConfiguracionComponent;
  @ViewChild(TablaConfiguracionComponent) tablaComponent!: TablaConfiguracionComponent;

  // Estado del componente
  mostrarFormulario: boolean = false;
  modoEdicion: boolean = false;
  itemEdicion: ConfigurationItem | null = null;
  loading: boolean = false;

  ngOnInit(): void {
    this.suscribirACambios();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private suscribirACambios(): void {
    // Suscribirse a cambios de estado de loading
    this.configuracionService.loading$
      .pipe(takeUntil(this.destroy$))
      .subscribe(loading => {
        this.loading = loading;
        // Actualizar estado en tabla cuando cambie el loading
        if (this.tablaComponent) {
          this.tablaComponent.establecerDeshabilitarAcciones(loading || this.mostrarFormulario);
        }
      });

    // Suscribirse a cambios de tabla activa para cerrar formulario
    this.configuracionService.tablaActiva$
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => {
        this.cerrarFormulario();
      });
  }

  // Métodos de navegación
  volverAlMenu(): void {
    this.router.navigate(['/menu']);
  }

  // Métodos de manejo del formulario
  mostrarFormularioNuevo(): void {
    this.mostrarFormulario = true;
    this.modoEdicion = false;
    this.itemEdicion = null;
    
    if (this.formularioComponent) {
      this.formularioComponent.actualizarFormulario(null, false);
    }
    
    this.actualizarEstadoTabla();
  }

  mostrarFormularioEdicion(item: ConfigurationItem): void {
    this.mostrarFormulario = true;
    this.modoEdicion = true;
    this.itemEdicion = item;
    
    if (this.formularioComponent) {
      this.formularioComponent.actualizarFormulario(item, true);
    }
    
    this.actualizarEstadoTabla();
  }

  cerrarFormulario(): void {
    this.mostrarFormulario = false;
    this.modoEdicion = false;
    this.itemEdicion = null;
    this.actualizarEstadoTabla();
  }

  private actualizarEstadoTabla(): void {
    if (this.tablaComponent) {
      this.tablaComponent.establecerDeshabilitarAcciones(this.loading || this.mostrarFormulario);
    }
  }

  // Métodos de manejo de eventos de los subcomponentes
  async onGuardarFormulario(datos: any): Promise<void> {
    try {
      if (this.modoEdicion && this.itemEdicion) {
        if (!this.itemEdicion.id) {
          throw new Error('ID del item no disponible para edición');
        }
        await this.configuracionService.actualizarItem(this.itemEdicion.id, datos);
      } else {
        await this.configuracionService.crearItem(datos);
      }
      this.cerrarFormulario();
    } catch (error) {
      // El error ya es manejado por el servicio
      console.error('Error en operación CRUD:', error);
    }
  }

  onNuevoItem(): void {
    this.mostrarFormularioNuevo();
  }

  onEditarItem(item: ConfigurationItem): void {
    this.mostrarFormularioEdicion(item);
  }

  async onEliminarItem(item: ConfigurationItem): Promise<void> {
    try {
      if (!item.id) {
        throw new Error('ID del item no disponible para eliminación');
      }
      await this.configuracionService.eliminarItem(item.id);
    } catch (error) {
      // El error ya es manejado por el servicio
      console.error('Error al eliminar:', error);
    }
  }

  onCancelarFormulario(): void {
    this.cerrarFormulario();
  }

  // Getters para el template (compatibilidad con template existente)
  get isLoading(): boolean {
    return this.loading;
  }

  get configuracionActiva() {
    return this.configuracionService.getConfiguracionTablaActiva();
  }

  get tituloTabla(): string {
    return this.configuracionActiva?.nombre || '';
  }
}