import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { ToastService } from '../../../servicios/toast';
import { ToastContainerComponent } from '../../shared/toast-container/toast-container';
import { LoadingService } from '../../../servicios/loading';
import { ApoyoFamiliarService } from '../../../servicios/apoyo-familiar.service';
import { CarreraService } from '../../../servicios/carrera.service';
import { GestionService } from '../../../servicios/gestion.service';
import { Gestion } from '../../../interfaces/gestion';
import { RegistroEstudiante } from '../../../interfaces/registro-estudiante';
import * as XLSX from 'xlsx';
import '../../../interfaces/electron-api';

interface GrupoFamiliar {
  rowNumber: number;
  cis: string[];
  registros?: RegistroEstudiante[];
  hasErrors?: boolean;
  errorMessage?: string;
}

@Component({
  selector: 'app-registro-masivo',
  imports: [CommonModule, RouterLink, ToastContainerComponent],
  templateUrl: './registro-masivo.html',
  styleUrl: './registro-masivo.scss'
})
export class RegistroMasivo implements OnInit {
  private toastService = inject(ToastService);
  private loadingService = inject(LoadingService);
  private apoyoFamiliarService = inject(ApoyoFamiliarService);
  private carreraService = inject(CarreraService);
  private gestionService = inject(GestionService);
  
  // File upload state
  selectedFile: File | null = null;
  isDragging = false;
  isProcessing = false;
  
  // Parsed data from Excel
  uploadedGroups: GrupoFamiliar[] = [];
  
  // Processing state
  isCalculating = false;
  semestreActual: Gestion[] = [];
  processedGroups: GrupoFamiliar[] = [];
  
  // Delete confirmation modal
  showDeleteConfirmModal = false;
  groupToDelete: GrupoFamiliar | null = null;
  
  async ngOnInit() {
    await this.gestionService.loadGestionData();
    this.semestreActual = this.gestionService.getActiveGestiones();
    
    if (this.semestreActual.length === 0) {
      console.warn('No se encontraron gestiones activas');
    }
  }
  
  descargarPlantilla(): void {
    try {
      // Create workbook with template structure
      const wb = XLSX.utils.book_new();
      
      // Define template headers
      const headers = ['CI o Nombre Hermano 1', 'CI o Nombre Hermano 2', 'CI o Nombre Hermano 3', 'CI o Nombre Hermano 4', 'CI o Nombre Hermano 5'];
      
      // Create worksheet from headers
      const ws = XLSX.utils.aoa_to_sheet([headers]);
      
      // Set column widths
      ws['!cols'] = [
        { wch: 20 },
        { wch: 20 },
        { wch: 20 },
        { wch: 20 },
        { wch: 20 }
      ];
      
      // Add worksheet to workbook
      XLSX.utils.book_append_sheet(wb, ws, 'Grupos Familiares');
      
      // Generate and download
      const fileName = 'plantilla_apoyo_familiar.xlsx';
      XLSX.writeFile(wb, fileName);
      
      this.toastService.success(
        'Plantilla descargada',
        'Archivo plantilla_apoyo_familiar.xlsx descargado correctamente',
        3000
      );
    } catch (error) {
      console.error('Error generando plantilla:', error);
      this.toastService.error(
        'Error al generar plantilla',
        'No se pudo crear el archivo de plantilla'
      );
    }
  }
  
  onDragOver(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.isDragging = true;
  }
  
  onDragLeave(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.isDragging = false;
  }
  
  onDrop(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.isDragging = false;
    
    const files = event.dataTransfer?.files;
    if (files && files.length > 0) {
      this.handleFileSelection(files[0]);
    }
  }
  
  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      this.handleFileSelection(input.files[0]);
    }
  }
  
  private handleFileSelection(file: File): void {
    // Validate file type
    if (!file.name.endsWith('.xlsx') && !file.name.endsWith('.xls')) {
      this.toastService.error(
        'Formato inválido',
        'Por favor, sube un archivo Excel (.xlsx o .xls)'
      );
      return;
    }
    
    this.selectedFile = file;
    this.toastService.info(
      'Archivo seleccionado',
      `${file.name} listo para procesar`,
      3000
    );
  }
  
  procesarArchivo(): void {
    if (!this.selectedFile) {
      this.toastService.warning('Sin archivo', 'Selecciona un archivo Excel primero');
      return;
    }
    
    this.isProcessing = true;
    
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        
        // Get first sheet
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        
        // Convert to JSON
        const jsonData: any[] = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
        
        // Parse groups (skip header row)
        this.uploadedGroups = [];
        
        for (let i = 1; i < jsonData.length; i++) {
          const row = jsonData[i];
          
          // Extract CIs from row (filter empty cells)
          const cis: string[] = [];
          for (let col = 0; col < 5; col++) {
            const cellValue = row[col];
            if (cellValue !== undefined && cellValue !== null && String(cellValue).trim() !== '') {
              cis.push(String(cellValue).trim());
            }
          }
          
          // Only add groups with at least 2 students
          if (cis.length >= 2) {
            this.uploadedGroups.push({
              rowNumber: i + 1,
              cis
            });
          }
        }
        
        if (this.uploadedGroups.length === 0) {
          this.toastService.warning(
            'Sin datos válidos',
            'El archivo no contiene grupos con al menos 2 estudiantes'
          );
        } else {
          this.toastService.success(
            'Archivo procesado',
            `Se encontraron ${this.uploadedGroups.length} grupos para procesar`,
            3000
          );
        }
        
      } catch (error) {
        console.error('Error procesando archivo:', error);
        this.toastService.error(
          'Error al leer archivo',
          'No se pudo procesar el archivo Excel'
        );
      } finally {
        this.isProcessing = false;
      }
    };
    
    reader.onerror = () => {
      this.toastService.error('Error de lectura', 'No se pudo leer el archivo');
      this.isProcessing = false;
    };
    
    reader.readAsArrayBuffer(this.selectedFile);
  }
  
  limpiarArchivo(): void {
    this.selectedFile = null;
    this.uploadedGroups = [];
    this.processedGroups = [];
    
    // Reset file input
    const fileInput = document.getElementById('fileInput') as HTMLInputElement;
    if (fileInput) {
      fileInput.value = '';
    }
  }
  
  async calcularDescuentos(): Promise<void> {
    if (this.uploadedGroups.length === 0) {
      this.toastService.warning('Sin grupos', 'No hay grupos para procesar');
      return;
    }
    
    this.isCalculating = true;
    this.loadingService.show();
    this.processedGroups = [];
    
    try {
      // Process each group
      for (const grupo of this.uploadedGroups) {
        try {
          const registros = await this.procesarGrupo(grupo);
          
          // Calculate discount percentages for this group
          this.calcularPorcentajesGrupo(registros);
          
          this.processedGroups.push({
            ...grupo,
            registros,
            hasErrors: false
          });
        } catch (error) {
          console.error(`Error procesando grupo ${grupo.rowNumber}:`, error);
          this.processedGroups.push({
            ...grupo,
            hasErrors: true,
            errorMessage: error instanceof Error ? error.message : 'Error desconocido'
          });
        }
      }
      
      const exitosos = this.processedGroups.filter(g => !g.hasErrors).length;
      const fallidos = this.processedGroups.filter(g => g.hasErrors).length;
      
      if (exitosos > 0) {
        this.toastService.success(
          'Cálculo completado',
          `${exitosos} grupos procesados exitosamente${fallidos > 0 ? ` (${fallidos} con errores)` : ''}`,
          3000
        );
      } else {
        this.toastService.error(
          'Error en todos los grupos',
          'Ningún grupo pudo ser procesado correctamente'
        );
      }
      
    } catch (error) {
      console.error('Error calculando descuentos:', error);
      this.toastService.error(
        'Error de procesamiento',
        'No se pudieron calcular los descuentos'
      );
    } finally {
      this.isCalculating = false;
      this.loadingService.hide();
    }
  }
  
  private async procesarGrupo(grupo: GrupoFamiliar): Promise<RegistroEstudiante[]> {
    const registros: RegistroEstudiante[] = [];
    
    if (!window.academicoAPI) {
      throw new Error('API de Académico no disponible');
    }
    
    for (const ci of grupo.cis) {
      try {
        // Search for student by CI
        const personas = await window.academicoAPI.obtenerPersonasPorCarnet(ci);
        
        if (personas.length === 0) {
          throw new Error(`No se encontró estudiante con CI: ${ci}`);
        }
        
        const persona = personas[0];
        const idEstudiante = persona.id;
        
        // Get kardex information
        const kardex = await window.academicoAPI.obtenerKardexEstudiante(idEstudiante);
        const [totalCreditos, carrera] = await this.obtenerInformacionKardex(kardex);
        
        // Get payment information
        const [referencia, planAccedido, pagoRealizado] = await this.obtenerPlanDePagoRealizado(idEstudiante);
        
        // Get career info from service
        const carreras = this.carreraService.currentData;
        const carreraInfo = carreras.find(c => 
          c.carrera.normalize('NFD').replace(/[\u0300-\u036f]/g, '') === 
          carrera.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
        );
        
        if (!carreraInfo) {
          throw new Error(`Carrera no encontrada en sistema: ${carrera} para estudiante ${ci}`);
        }
        
        const valorCredito = carreraInfo.tarifario?.valor_credito || 0;
        const creditoTecnologico = carreraInfo.incluye_tecnologico ? valorCredito : 0;
        const totalSemestre = valorCredito * totalCreditos + creditoTecnologico;
        
        const registro: RegistroEstudiante = {
          id: crypto.randomUUID(),
          id_solicitud: '', // Will be set when saving
          id_gestion: this.semestreActual[0]?.id || '',
          id_estudiante_siaan: idEstudiante,
          ci_estudiante: ci,
          nombre_estudiante: persona.nombreCompleto || persona.nombre || 'N/A',
          carrera,
          total_creditos: totalCreditos,
          valor_credito: valorCredito,
          credito_tecnologico: creditoTecnologico,
          porcentaje_descuento: 0, // Will be calculated
          monto_primer_pago: pagoRealizado,
          plan_primer_pago: planAccedido,
          referencia_primer_pago: referencia,
          total_semestre: totalSemestre,
          registrado: false,
          comentarios: ''
        };
        
        registros.push(registro);
        
      } catch (error) {
        console.error(`Error procesando CI ${ci}:`, error);
        throw error;
      }
    }
    
    return registros;
  }
  
  private async obtenerInformacionKardex(kardex: any[]): Promise<[number, string]> {
    let totalCreditos = 0;
    let carrera = '';
    let semestresEncontrados = 0;
    
    const nombresGestiones = this.semestreActual.map(g => g.gestion);
    
    for (let i = kardex.length - 1; i >= 0; i--) {
      const semestre = kardex[i];
      const encabezadoSemestre = semestre.encabezado[0];
      
      const gestionEncontrada = nombresGestiones.find(nombre => encabezadoSemestre.includes(nombre));
      
      if (gestionEncontrada) {
        const creditosSemestre = parseInt(
          semestre.tabla.datos[semestre.tabla.datos.length - 1][6].contenidoCelda[0].contenido,
          10
        );
        
        totalCreditos += creditosSemestre;
        
        if (!carrera) {
          carrera = semestre.encabezado[semestre.encabezado.length - 1]
            .split(': ')
            .pop()
            ?.normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '') || '';
        }
        
        semestresEncontrados++;
      }
    }
    
    if (semestresEncontrados === 0) {
      const gestionsStr = nombresGestiones.join(', ');
      throw new Error(`No se encontró información para las gestiones "${gestionsStr}"`);
    }
    
    return [totalCreditos, carrera];
  }
  
  private async obtenerPlanDePagoRealizado(id_estudiante: string): Promise<[string, string, number]> {
    let referencia = "";
    let planAccedido = "";
    let pagoRealizado = 0;
    
    if (!window.academicoAPI) {
      return [referencia, 'No encontrado', pagoRealizado];
    }
    
    try {
      const pagos = await window.academicoAPI.obtenerPagosRealizados(id_estudiante);
      
      for (const pago of pagos) {
        if (pago[4]?.contenidoCelda?.[0]?.contenido === "FACTURA REGULAR") {
          const parametros = pago[pago.length - 1]?.contenidoCelda?.[0]?.parametros;
          if (parametros && parametros.length >= 3) {
            const numeroMaestro = parametros[0]?.valorParametro;
            const idRegional = parametros[1]?.valorParametro;
            const orden = parametros[2]?.valorParametro;
            
            if (numeroMaestro && idRegional && orden) {
              const detalleFactura = await window.academicoAPI.obtenerDetalleFactura(
                numeroMaestro, 
                idRegional, 
                orden
              );
              
              for (const factura of detalleFactura) {
                referencia = factura[1]?.contenidoCelda?.[0]?.contenido || "";
                
                const gestionEncontrada = this.semestreActual.some(gestion => 
                  referencia.includes(gestion.gestion)
                );
                
                if (gestionEncontrada) {
                  if (referencia.includes("ESTANDAR") || referencia.includes("ESTÁNDAR")) {
                    planAccedido = "PLAN ESTANDAR";
                    pagoRealizado = parseFloat(
                      (factura[factura.length - 1]?.contenidoCelda?.[0]?.contenido || "0")
                        .replace(",", "")
                    );
                    break;
                  } else if (referencia.includes("PLUS")) {
                    planAccedido = "PLAN PLUS";
                    pagoRealizado = parseFloat(
                      (factura[factura.length - 1]?.contenidoCelda?.[0]?.contenido || "0")
                        .replace(",", "")
                    );
                    break;
                  }
                }
              }
              
              if (planAccedido) {
                break;
              }
            }
          }
        }
      }
    } catch (error) {
      console.error('Error obteniendo plan de pago:', error);
    }
    
    // Return empty values if not found (will be handled in UI)
    return [referencia, planAccedido || 'No encontrado', pagoRealizado];
  }
  
  private calcularPorcentajesGrupo(registros: RegistroEstudiante[]): void {
    // Sort by total credits descending
    registros.sort((a, b) => (b.total_creditos || 0) - (a.total_creditos || 0));
    
    const apoyoFamiliarData = this.apoyoFamiliarService.currentData
      .sort((a, b) => a.orden - b.orden);
    
    registros.forEach((registro, index) => {
      const apoyo = apoyoFamiliarData[index] || null;
      registro.porcentaje_descuento = apoyo ? apoyo.porcentaje : 0;
    });
  }
  
  // Delete group methods
  confirmarEliminarGrupo(grupo: GrupoFamiliar): void {
    this.groupToDelete = grupo;
    this.showDeleteConfirmModal = true;
  }
  
  cancelarEliminacion(): void {
    this.groupToDelete = null;
    this.showDeleteConfirmModal = false;
  }
  
  eliminarGrupo(): void {
    if (!this.groupToDelete) {
      return;
    }
    
    // Remove from processedGroups
    this.processedGroups = this.processedGroups.filter(
      g => g.rowNumber !== this.groupToDelete!.rowNumber
    );
    
    this.toastService.success(
      'Grupo eliminado',
      `Grupo ${this.groupToDelete.rowNumber} eliminado correctamente`
    );
    
    this.groupToDelete = null;
    this.showDeleteConfirmModal = false;
  }
}
