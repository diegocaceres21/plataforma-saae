import { Component } from '@angular/core';
import { RegistroEstudiante } from '../../../interfaces/registro-estudiante';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import * as XLSX from 'xlsx';
import { ToastService } from '../../../servicios/toast';
import { ToastContainerComponent } from '../../shared/toast-container/toast-container';
import { ExportConfigModalComponent } from '../../shared/export-config-modal/export-config-modal';
import { ExportConfig } from '../../../interfaces/export-config';

@Component({
  selector: 'app-vista-individual',
  imports: [CommonModule, RouterModule, ToastContainerComponent, ExportConfigModalComponent],
  templateUrl: './vista-individual.html',
  styleUrl: './vista-individual.scss'
})
export class VistaIndividual {
  registrosEstudiantes: Partial<RegistroEstudiante>[] = [
    {
        ci_estudiante: "E-10268053",
        nombre_estudiante: "CACERES CORTEZ DIEGO ISAIAS",
        carrera: "INGENIERIA EMPRESARIAL",
        total_creditos: 15,
        plan_primer_pago: "PLAN ESTANDAR",
        monto_primer_pago: 1428,
        referencia_primer_pago: "PRIMER PAGO ESTANDAR TUPURAYA 1-2024",
        porcentaje_descuento: 0, //INVENTADO
        valor_credito: 357, //INVENTADO,
        credito_tecnologico: 357, //INVENTADO
        total_semestre: 5712
    },
    {
        ci_estudiante: "6555232",
        nombre_estudiante: "VARGAS SINGER SARA ELENA",
        carrera: "ADMINISTRACION DE EMPRESAS",
        total_creditos: 15,
        plan_primer_pago: "PLAN ESTANDAR",
        monto_primer_pago: 1428,
        referencia_primer_pago: "PRIMER PAGO ESTANDAR TUPURAYA 1-2024",
        porcentaje_descuento: 0.2,
        valor_credito: 357,
        credito_tecnologico: 357,
        total_semestre: 5712
    }
  ];

  expandedItems: Set<number> = new Set();
  
  // Estados para feedback visual
  isExporting = false;
  isSaving = false;
  isGeneratingPDF = false;
  
  // Modal de configuración
  showExportModal = false;
  exportConfig: ExportConfig | null = null;

  constructor(private toastService: ToastService) {}

  toggleAccordion(index: number): void {
    if (this.expandedItems.has(index)) {
      this.expandedItems.delete(index);
    } else {
      this.expandedItems.add(index);
    }
  }

  isExpanded(index: number): boolean {
    return this.expandedItems.has(index);
  }

  guardarRegistro(): void {
    this.isSaving = true;
    
    // Simular proceso de guardado
    setTimeout(() => {
      this.isSaving = false;
      this.toastService.success(
        'Guardado Exitoso', 
        `Se guardaron ${this.registrosEstudiantes.length} registros correctamente`
      );
      console.log('Guardando registro...', this.registrosEstudiantes);
    }, 2000);
  }

  exportarPDF(): void {
    this.isGeneratingPDF = true;
    
    // Simular proceso de generación de PDF
    setTimeout(() => {
      this.isGeneratingPDF = false;
      this.toastService.success(
        'PDF Generado', 
        'El archivo PDF se ha descargado exitosamente'
      );
      console.log('Exportando a PDF...', this.registrosEstudiantes);
    }, 3000);
  }

  // Método actualizado para abrir modal de configuración
  exportarExcel(): void {
    if (this.registrosEstudiantes.length === 0) {
      this.toastService.warning(
        'Sin Datos', 
        'No hay registros disponibles para exportar'
      );
      return;
    }
    
    this.showExportModal = true;
  }

  // Nuevo método para manejar el cierre del modal
  onExportModalClose(): void {
    this.showExportModal = false;
  }

  // Nuevo método para manejar la exportación con configuración
  onExportConfirmed(config: ExportConfig): void {
    this.showExportModal = false;
    this.performExcelExport(config);
  }

  // Método mejorado de exportación
  private performExcelExport(config: ExportConfig): void {
    this.isExporting = true;
    
    try {
      // Simular tiempo de procesamiento
      setTimeout(() => {
        const enabledColumns = config.columns.filter(col => col.enabled);
        
        // Crear datos para Excel basados en columnas seleccionadas
        const datosExcel = this.registrosEstudiantes.map(registro => {
          const fila: any = {};
          
          enabledColumns.forEach(column => {
            switch (column.key) {
              case 'ci_estudiante':
                fila[column.label] = registro.ci_estudiante || '';
                break;
              case 'nombre_estudiante':
                fila[column.label] = registro.nombre_estudiante || '';
                break;
              case 'carrera':
                fila[column.label] = registro.carrera || '';
                break;
              case 'total_creditos':
                fila[column.label] = registro.total_creditos || 0;
                break;
              case 'valor_credito':
                fila[column.label] = registro.valor_credito || 0;
                break;
              case 'credito_tecnologico':
                fila[column.label] = registro.credito_tecnologico || 0;
                break;
              case 'porcentaje_descuento':
                fila[column.label] = registro.porcentaje_descuento ? (registro.porcentaje_descuento * 100).toFixed(1) + '%' : '0%';
                break;
              case 'monto_primer_pago':
                fila[column.label] = registro.monto_primer_pago || 0;
                break;
              case 'plan_primer_pago':
                fila[column.label] = registro.plan_primer_pago || '';
                break;
              case 'referencia_primer_pago':
                fila[column.label] = registro.referencia_primer_pago || '';
                break;
              case 'total_semestre':
                fila[column.label] = registro.total_semestre || 0;
                break;
              case 'registrado':
                fila[column.label] = registro.registrado ? 'Sí' : 'No';
                break;
              case 'comentarios':
                fila[column.label] = registro.comentarios || '';
                break;
              // Campos calculados
              case 'derechos_academicos_originales':
                fila[column.label] = (registro.valor_credito || 0) * (registro.total_creditos || 0);
                break;
              case 'derechos_academicos_descuento':
                fila[column.label] = ((registro.valor_credito || 0) * (registro.total_creditos || 0)) * (1 - (registro.porcentaje_descuento || 0));
                break;
              case 'ahorro_descuento':
                fila[column.label] = ((registro.valor_credito || 0) * (registro.total_creditos || 0)) * (registro.porcentaje_descuento || 0);
                break;
              case 'saldo_semestre_original':
                fila[column.label] = (registro.total_semestre || 0) - (registro.monto_primer_pago || 0);
                break;
              case 'saldo_semestre_descuento':
                const saldoConDescuento = registro.porcentaje_descuento ? 
                  (((registro.valor_credito || 0) * (registro.total_creditos || 0)) * (1 - registro.porcentaje_descuento) + (registro.credito_tecnologico || 0) - (registro.monto_primer_pago || 0)) : 
                  ((registro.total_semestre || 0) - (registro.monto_primer_pago || 0));
                fila[column.label] = saldoConDescuento;
                break;
            }
          });
          
          return fila;
        });

        // Crear libro de trabajo
        const libro = XLSX.utils.book_new();
        
        // Crear hoja de trabajo principal
        const hoja = XLSX.utils.json_to_sheet(datosExcel);

        // Configurar anchos de columnas dinámicamente
        const anchosColumnas = enabledColumns.map(col => ({ wch: this.getColumnWidth(col.key) }));
        hoja['!cols'] = anchosColumnas;

        // Agregar hoja principal
        XLSX.utils.book_append_sheet(libro, hoja, 'Registros de Estudiantes');

        // Generar nombre de archivo con formato fijo DD/MM/YYYY
        const fecha = new Date();
        const fechaFormateada = this.formatDate(fecha);
        const horaFormateada = fecha.toTimeString().split(' ')[0].replace(/:/g, '-');
        const nombreArchivo = `${config.fileName}_${fechaFormateada}_${horaFormateada}.xlsx`;

        // Exportar archivo
        XLSX.writeFile(libro, nombreArchivo);
        
        this.isExporting = false;
        
        this.toastService.success(
          'Exportación Completada', 
          `Archivo "${nombreArchivo}" descargado exitosamente con ${datosExcel.length} registros y ${enabledColumns.length} columnas`,
          3000
        );
        
      }, 1500);
      
    } catch (error) {
      this.isExporting = false;
      this.toastService.error(
        'Error en Exportación', 
        'Ocurrió un error al generar el archivo Excel. Por favor, intente nuevamente.'
      );
      console.error('Error exportando Excel:', error);
    }
  }

  private formatCurrency(value: number, format: string): string | number {
    // Siempre retornar solo el número
    return value;
  }

  private formatDate(date: Date): string {
    // Formato fijo DD/MM/YYYY
    const day = date.getDate().toString().padStart(2, '0');
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const year = date.getFullYear();
    return `${day}-${month}-${year}`;
  }

  private getColumnWidth(key: string): number {
    const widths: { [key: string]: number } = {
      'ci_estudiante': 18,
      'nombre_estudiante': 35,
      'carrera': 30,
      'total_creditos': 15,
      'valor_credito': 18,
      'credito_tecnologico': 20,
      'porcentaje_descuento': 20,
      'monto_primer_pago': 20,
      'plan_primer_pago': 25,
      'referencia_primer_pago': 40,
      'total_semestre': 18,
      'registrado': 12,
      'comentarios': 30,
      'derechos_academicos_originales': 28,
      'derechos_academicos_descuento': 30,
      'ahorro_descuento': 20,
      'saldo_semestre_original': 25,
      'saldo_semestre_descuento': 28
    };
    return widths[key] || 20;
  }
}
