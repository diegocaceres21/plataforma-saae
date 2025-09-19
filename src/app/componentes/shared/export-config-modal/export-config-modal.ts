import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ExportConfig, ExportColumn } from '../../../interfaces/export-config';

@Component({
  selector: 'app-export-config-modal',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <!-- Modal Backdrop -->
    @if (isVisible) {
      <div class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
        <div class="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden">
          
          <!-- Modal Header -->
          <div class="bg-gradient-to-r from-blue-900 to-blue-800 text-white p-6">
            <div class="flex items-center justify-between">
              <div class="flex items-center">
                <svg class="w-8 h-8 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
                </svg>
                <h2 class="text-2xl font-bold">Configuración de Exportación</h2>
              </div>
              <button 
                (click)="closeModal()"
                class="text-white hover:text-gray-300 transition-colors duration-200">
                <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
                </svg>
              </button>
            </div>
          </div>

          <!-- Modal Content -->
          <div class="p-6 overflow-y-auto max-h-[calc(90vh-200px)]">
            
            <!-- File Configuration Section -->
            <div class="mb-8">
              <h3 class="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                <svg class="w-5 h-5 mr-2 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
                </svg>
                Configuración del Archivo
              </h3>
              
              <div class="grid grid-cols-1 gap-4">
                <!-- File Name -->
                <div>
                  <label class="block text-sm font-medium text-gray-700 mb-2">Nombre del Archivo</label>
                  <input 
                    type="text" 
                    [(ngModel)]="config.fileName"
                    class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors duration-200"
                    placeholder="apoyo_familiar">
                </div>
              </div>
            </div>

            <!-- Columns Selection Section -->
            <div class="mb-8">
              <div class="flex items-center justify-between mb-4">
                <h3 class="text-lg font-semibold text-gray-900 flex items-center">
                  <svg class="w-5 h-5 mr-2 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 10h16M4 14h16M4 18h16"></path>
                  </svg>
                  Selección de Columnas
                </h3>
                
                <div class="flex gap-2">
                  <button 
                    (click)="selectAllColumns()"
                    class="px-3 py-1 text-sm bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 transition-colors duration-200">
                    Seleccionar Todas
                  </button>
                  <button 
                    (click)="deselectAllColumns()"
                    class="px-3 py-1 text-sm bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors duration-200">
                    Deseleccionar Todas
                  </button>
                </div>
              </div>

              <!-- Basic Columns -->
              <div class="mb-6">
                <h4 class="text-md font-medium text-gray-800 mb-3">Campos Básicos</h4>
                <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  @for (column of getBasicColumns(); track column.key) {
                    <label class="flex items-center p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors duration-200 cursor-pointer">
                      <input 
                        type="checkbox" 
                        [(ngModel)]="column.enabled"
                        class="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500">
                      <span class="ml-2 text-sm font-medium text-gray-700">{{ column.label }}</span>
                    </label>
                  }
                </div>
              </div>

              <!-- Calculated Fields Toggle -->
              <div class="mb-4">
                <label class="flex items-center p-4 bg-yellow-50 rounded-lg border border-yellow-200">
                  <input 
                    type="checkbox" 
                    [(ngModel)]="config.includeCalculatedFields"
                    (change)="toggleCalculatedFields()"
                    class="w-4 h-4 text-yellow-600 border-gray-300 rounded focus:ring-yellow-500">
                  <div class="ml-3">
                    <span class="text-sm font-medium text-yellow-800">Incluir Campos Calculados</span>
                    <p class="text-xs text-yellow-700 mt-1">Descuentos aplicados, ahorros y cálculos automáticos</p>
                  </div>
                </label>
              </div>

              <!-- Calculated Columns -->
              @if (config.includeCalculatedFields) {
                <div>
                  <h4 class="text-md font-medium text-gray-800 mb-3">Campos Calculados</h4>
                  <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
                    @for (column of getCalculatedColumns(); track column.key) {
                      <label class="flex items-center p-3 bg-green-50 rounded-lg hover:bg-green-100 transition-colors duration-200 cursor-pointer">
                        <input 
                          type="checkbox" 
                          [(ngModel)]="column.enabled"
                          class="w-4 h-4 text-green-600 border-gray-300 rounded focus:ring-green-500">
                        <span class="ml-2 text-sm font-medium text-green-700">{{ column.label }}</span>
                      </label>
                    }
                  </div>
                </div>
              }
            </div>

          </div>

          <!-- Modal Footer -->
          <div class="bg-gray-50 px-6 py-4 flex justify-between items-center">
            <div class="text-sm text-gray-600">
              {{ getSelectedColumnsCount() }} columnas seleccionadas
            </div>
            
            <div class="flex gap-3">
              <button 
                (click)="closeModal()"
                class="px-6 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors duration-200 font-medium">
                Cancelar
              </button>
              
              <button 
                (click)="confirmExport()"
                [disabled]="getSelectedColumnsCount() === 0"
                class="px-6 py-2 bg-gradient-to-r from-blue-600 to-blue-500 text-white rounded-lg hover:from-blue-700 hover:to-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 font-medium shadow-lg">
                <svg class="w-4 h-4 inline mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
                </svg>
                Exportar Excel
              </button>
            </div>
          </div>

        </div>
      </div>
    }
  `
})
export class ExportConfigModalComponent {
  @Input() isVisible = false;
  @Input() config: ExportConfig = this.getDefaultConfig();
  @Output() close = new EventEmitter<void>();
  @Output() export = new EventEmitter<ExportConfig>();

  getDefaultConfig(): ExportConfig {
    return {
      columns: [
        // Basic Fields (sin incluir campos ID)
        { key: 'ci_estudiante', label: 'Carnet de Identidad', enabled: true },
        { key: 'nombre_estudiante', label: 'Nombre Completo', enabled: true },
        { key: 'carrera', label: 'Carrera', enabled: true },
        { key: 'total_creditos', label: 'Total U.V.E.', enabled: true },
        { key: 'valor_credito', label: 'Valor por U.V.E.', enabled: true },
        { key: 'credito_tecnologico', label: 'Crédito Tecnológico', enabled: true },
        { key: 'porcentaje_descuento', label: 'Porcentaje Descuento', enabled: true },
        { key: 'monto_primer_pago', label: 'Monto Primer Pago', enabled: true },
        { key: 'plan_primer_pago', label: 'Plan Primer Pago', enabled: true },
        { key: 'referencia_primer_pago', label: 'Referencia Primer Pago', enabled: true },
        { key: 'total_semestre', label: 'Total Semestre', enabled: true },
        { key: 'registrado', label: 'Registrado', enabled: false },
        { key: 'comentarios', label: 'Comentarios', enabled: false },
        
        // Calculated Fields
        { key: 'derechos_academicos_originales', label: 'Derechos Académicos Originales', enabled: true, isCalculated: true },
        { key: 'derechos_academicos_descuento', label: 'Derechos Académicos con Descuento', enabled: true, isCalculated: true },
        { key: 'ahorro_descuento', label: 'Ahorro por Descuento', enabled: true, isCalculated: true },
        { key: 'saldo_semestre_original', label: 'Saldo Semestre Original', enabled: true, isCalculated: true },
        { key: 'saldo_semestre_descuento', label: 'Saldo Semestre con Descuento', enabled: true, isCalculated: true }
      ],
      includeCalculatedFields: true,
      fileName: 'apoyo_familiar',
    };
  }

  closeModal() {
    this.close.emit();
  }

  confirmExport() {
    this.export.emit(this.config);
  }

  getBasicColumns(): ExportColumn[] {
    return this.config.columns.filter(col => !col.isCalculated);
  }

  getCalculatedColumns(): ExportColumn[] {
    return this.config.columns.filter(col => col.isCalculated);
  }

  getSelectedColumnsCount(): number {
    return this.config.columns.filter(col => col.enabled).length;
  }

  selectAllColumns() {
    this.config.columns.forEach(col => col.enabled = true);
  }

  deselectAllColumns() {
    this.config.columns.forEach(col => col.enabled = false);
  }

  toggleCalculatedFields() {
    const calculatedColumns = this.getCalculatedColumns();
    calculatedColumns.forEach(col => col.enabled = this.config.includeCalculatedFields);
  }
}