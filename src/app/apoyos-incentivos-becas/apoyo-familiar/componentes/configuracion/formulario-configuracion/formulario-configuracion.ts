import { Component, Input, Output, EventEmitter, OnInit, OnDestroy, inject, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ConfiguracionService, ConfigurationItem } from '../../../../../shared/servicios/configuracion';
import { Subject, takeUntil } from 'rxjs';

interface CampoFormulario {
  key: string;
  label: string;
  type: 'text' | 'number' | 'date' | 'select' | 'checkbox';
  required: boolean;
  options?: { value: any; label: string }[];
  min?: number;
  max?: number;
  step?: number;
}

@Component({
  selector: 'app-formulario-configuracion',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    @if (mostrar) {
      <div class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
           (click)="onBackdropClick($event)"
           tabindex="-1">
        <div class="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto"
             (click)="$event.stopPropagation()">
          <div class="flex justify-between items-center p-6 border-b border-gray-200">
            <h4 class="text-lg font-semibold text-gray-900">
              {{ modoEdicion ? 'Editar' : 'Nuevo' }} {{ nombreSingular }}
            </h4>
            <button
              type="button"
              (click)="cancelar()"
              [disabled]="enviando"
              class="text-gray-400 hover:text-gray-600 disabled:text-gray-300 p-1 rounded-lg hover:bg-gray-100 transition-colors">
              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
              </svg>
            </button>
          </div>

          <div class="p-6">
            <form (ngSubmit)="onSubmit()" class="space-y-4">
              @for (campo of campos; track campo.key) {
                <div [ngClass]="obtenerClasesCampo(campo)">
                  @if (campo.type !== 'checkbox') {
                    <label [for]="campo.key" class="block text-sm font-medium text-gray-700 mb-1">
                      {{ campo.label }}
                      @if (campo.required) {
                        <span class="text-red-500">*</span>
                      }
                    </label>
                  }

                  @switch (campo.type) {
                    @case ('text') {
                      <input
                        [id]="campo.key"
                        type="text"
                        [(ngModel)]="formulario[campo.key]"
                        [name]="campo.key"
                        [required]="campo.required"
                        [disabled]="enviando"
                        class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
                        [placeholder]="'Ingrese ' + campo.label.toLowerCase()">
                    }

                    @case ('number') {
                      <input
                        [id]="campo.key"
                        type="number"
                        [(ngModel)]="formulario[campo.key]"
                        [name]="campo.key"
                        [required]="campo.required"
                        [disabled]="enviando"
                        [min]="campo.min ?? null"
                        [max]="campo.max ?? null"
                        [step]="campo.step ?? null"
                        class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
                        [placeholder]="campo.min?.toString() || '0'">
                    }

                    @case ('date') {
                      <input
                        [id]="campo.key"
                        type="date"
                        [(ngModel)]="formulario[campo.key]"
                        [name]="campo.key"
                        [required]="campo.required"
                        [disabled]="enviando"
                        class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100">
                    }

                    @case ('select') {
                      <select
                        [id]="campo.key"
                        [(ngModel)]="formulario[campo.key]"
                        [name]="campo.key"
                        [required]="campo.required"
                        [disabled]="enviando"
                        class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100">
                        <option value="">Seleccionar {{ campo.label.toLowerCase() }}</option>
                        @for (opcion of campo.options; track opcion.value) {
                          <option [value]="opcion.value">{{ opcion.label }}</option>
                        }
                      </select>
                    }

                    @case ('checkbox') {
                      <div class="flex items-center">
                        <input
                          [id]="campo.key"
                          type="checkbox"
                          [(ngModel)]="formulario[campo.key]"
                          [name]="campo.key"
                          [disabled]="enviando"
                          class="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded disabled:bg-gray-100">
                        <label [for]="campo.key" class="ml-2 text-sm text-gray-700">
                          {{ campo.label }}
                        </label>
                      </div>
                    }
                  }

                  @if (obtenerErrorCampo(campo.key)) {
                    <p class="mt-1 text-sm text-red-600">{{ obtenerErrorCampo(campo.key) }}</p>
                  }
                </div>
              }
            </form>
          </div>

          <div class="flex justify-end space-x-3 p-6 border-t border-gray-200 bg-gray-50 rounded-b-xl">
            <button
              type="button"
              (click)="cancelar()"
              [disabled]="enviando"
              class="inline-flex items-center px-4 py-2 bg-white hover:bg-gray-50 disabled:bg-gray-100
                     text-gray-700 disabled:text-gray-400 font-medium text-sm rounded-lg border border-gray-300
                     hover:border-gray-400 transition-colors duration-200">
              Cancelar
            </button>
            <button
              type="button"
              (click)="onSubmit()"
              [disabled]="enviando || !esFormularioValido()"
              class="inline-flex items-center px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400
                     text-white font-medium text-sm rounded-lg transition-colors duration-200">
              @if (enviando) {
                <div class="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
              }
              {{ modoEdicion ? 'Actualizar' : 'Crear' }}
            </button>
          </div>
        </div>
      </div>
    }
  `,
  styles: [`
    .fixed {
      animation: modalFadeIn 0.2s ease-out;
    }

    .bg-white.rounded-xl {
      animation: modalSlideIn 0.3s ease-out;
    }

    @keyframes modalFadeIn {
      from { opacity: 0; }
      to { opacity: 1; }
    }

    @keyframes modalSlideIn {
      from {
        opacity: 0;
        transform: translateY(-20px) scale(0.95);
      }
      to {
        opacity: 1;
        transform: translateY(0) scale(1);
      }
    }
  `]
})
export class FormularioConfiguracionComponent implements OnInit, OnDestroy {
  private configuracionService = inject(ConfiguracionService);
  private destroy$ = new Subject<void>();

  @Input() mostrar: boolean = false;
  @Input() modoEdicion: boolean = false;
  @Input() itemEdicion: ConfigurationItem | null = null;

  @Output() guardar = new EventEmitter<any>();
  @Output() cancelarFormulario = new EventEmitter<void>();

  formulario: any = {};
  campos: CampoFormulario[] = [];
  nombreSingular: string = '';
  enviando: boolean = false;
  errores: Record<string, string> = {};

  ngOnInit(): void {
    this.suscribirACambios();
    this.inicializarFormulario();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  @HostListener('document:keydown.escape')
  onEscapeKey(): void {
    if (this.mostrar) {
      this.cancelar();
    }
  }

  onBackdropClick(event: Event): void {
    if (event.target === event.currentTarget) {
      this.cancelar();
    }
  }

  private suscribirACambios(): void {
    this.configuracionService.tablaActiva$
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => {
        this.inicializarFormulario();
      });

    this.configuracionService.loading$
      .pipe(takeUntil(this.destroy$))
      .subscribe(loading => {
        this.enviando = loading;
      });

    // Actualizar cuando cambian las gestiones (y otros datos)
    this.configuracionService.gestiones$
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => {
        this.actualizarConfiguracionCampos();
      });

    // Actualizar cuando cambian los datos completos
    this.configuracionService.datos$
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => {
        this.actualizarConfiguracionCampos();
      });
  }

  private inicializarFormulario(): void {
    const configuracion = this.configuracionService.getConfiguracionTablaActiva();
    if (configuracion) {
      this.nombreSingular = configuracion.nombreSingular;
      // Obtener campos actualizados con opciones
      this.campos = this.configuracionService.getCamposTablaActiva();
      console.log('[FormularioConfig] Inicializado con campos:', this.campos.map(c => ({
        key: c.key,
        type: c.type,
        optionsCount: c.options?.length || 0
      })));
      this.resetearFormulario();
    }
  }

  private actualizarConfiguracionCampos(): void {
    // Obtener campos actualizados directamente del servicio
    const camposActualizados = this.configuracionService.getCamposTablaActiva();
    if (camposActualizados.length > 0) {
      this.campos = camposActualizados;
      console.log('[FormularioConfig] Campos actualizados:', this.campos.map(c => ({
        key: c.key,
        type: c.type,
        optionsCount: c.options?.length || 0
      })));
    }
  }

  private resetearFormulario(): void {
    if (this.modoEdicion && this.itemEdicion) {
      this.formulario = { ...this.itemEdicion };
    } else {
      this.formulario = this.configuracionService.crearItemVacio();
    }
    this.errores = {};
  }

  obtenerClasesCampo(campo: CampoFormulario): string {
    return 'w-full';
  }

  obtenerErrorCampo(campo: string): string | null {
    return this.errores[campo] || null;
  }

  esFormularioValido(): boolean {
    for (const campo of this.campos) {
      if (campo.required) {
        const valor = this.formulario[campo.key];
        if (valor === undefined || valor === null || valor === '') {
          return false;
        }
      }
    }
    return true;
  }

  private validarFormulario(): boolean {
    this.errores = {};
    let esValido = true;

    for (const campo of this.campos) {
      const valor = this.formulario[campo.key];

      if (campo.required && (valor === undefined || valor === null || valor === '')) {
        this.errores[campo.key] = `${campo.label} es obligatorio`;
        esValido = false;
        continue;
      }

      if (campo.type === 'number' && valor !== undefined && valor !== null && valor !== '') {
        const numValue = Number(valor);
        if (campo.min !== undefined && numValue < campo.min) {
          this.errores[campo.key] = `${campo.label} debe ser mayor o igual a ${campo.min}`;
          esValido = false;
        }
        if (campo.max !== undefined && numValue > campo.max) {
          this.errores[campo.key] = `${campo.label} debe ser menor o igual a ${campo.max}`;
          esValido = false;
        }
      }
    }

    return esValido;
  }

  onSubmit(): void {
    if (!this.validarFormulario()) {
      return;
    }

    const formularioLimpio = { ...this.formulario };
    for (const campo of this.campos) {
      if (!campo.required && formularioLimpio[campo.key] === '') {
        delete formularioLimpio[campo.key];
      }
    }

    this.guardar.emit(formularioLimpio);
  }

  cancelar(): void {
    this.resetearFormulario();
    this.cancelarFormulario.emit();
  }

  actualizarFormulario(item: ConfigurationItem | null, edicion: boolean = false): void {
    this.modoEdicion = edicion;
    this.itemEdicion = item;
    this.resetearFormulario();
  }
}
