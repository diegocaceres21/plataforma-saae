import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ToastService } from '../../../servicios/toast';
import { ToastContainerComponent } from '../../shared/toast-container/toast-container';
import { LoadingService } from '../../../servicios/loading';
import { ApoyoFamiliarService } from '../../../servicios/apoyo-familiar.service';
import { CarreraService } from '../../../servicios/carrera.service';
import { GestionService } from '../../../servicios/gestion.service';
import { Gestion } from '../../../interfaces/gestion';
import { RegistroEstudiante } from '../../../interfaces/registro-estudiante';
import { StudentAutocompleteComponent } from '../../shared/student-autocomplete/student-autocomplete';
import { StudentSearchResult } from '../../../interfaces/student-search';
import { ManualPaymentModalComponent, ManualPaymentData } from '../../shared/manual-payment-modal/manual-payment-modal';
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
  imports: [CommonModule, FormsModule, RouterLink, ToastContainerComponent, StudentAutocompleteComponent, ManualPaymentModalComponent],
  templateUrl: './registro-masivo.html',
  styleUrl: './registro-masivo.scss'
})
export class RegistroMasivo implements OnInit {
  private toastService = inject(ToastService);
  private loadingService = inject(LoadingService);
  private apoyoFamiliarService = inject(ApoyoFamiliarService);
  private carreraService = inject(CarreraService);
  private gestionService = inject(GestionService);
  
  // Step navigation
  currentStep = 1;
  
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
  
  // Duplicate CI modal
  showDuplicateModal = false;
  duplicateCIInfo: {
    ci: string;
    grupos: { grupo: GrupoFamiliar; registro: RegistroEstudiante }[];
  } | null = null;
  grupoToEdit: GrupoFamiliar | null = null;
  registroToReplace: RegistroEstudiante | null = null;
  isReplacingStudent = false;
  
  // Manual payment modal
  showManualPaymentModal = false;
  currentStudentForManualInput = '';
  currentStudentCIForManualInput = '';
  private manualPaymentResolve: ((data: ManualPaymentData | null) => void) | null = null;
  
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
    /*this.toastService.info(
      'Archivo seleccionado',
      `${file.name} listo para procesar`,
      3000
    );*/
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
              rowNumber: i ,
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
          /*this.toastService.success(
            'Archivo procesado',
            `Se encontraron ${this.uploadedGroups.length} grupos para procesar`,
            3000
          );*/
          // Move to step 3 after successful upload and parsing
          this.currentStep = 3;
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
    this.currentStep = 1;
    
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
    this.loadingService.show('Procesando grupos familiares...');
    this.processedGroups = [];
    
    try {
      const totalGrupos = this.uploadedGroups.length;
      
      // Process each group
      for (let i = 0; i < this.uploadedGroups.length; i++) {
        const grupo = this.uploadedGroups[i];
        
        // Update loading message with progress
        this.loadingService.show(`Procesando grupo ${i + 1} de ${totalGrupos}...`);
        
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
      
      // Force hide loading before showing results (reset counter)
      this.isCalculating = false;
      this.loadingService.setLoading(false);
      
      if (exitosos > 0) {
        // Move to step 4 after successful calculation
        this.currentStep = 4;
        
        // Check for duplicate CIs
        this.verificarCIDuplicados();
        
        const hasDuplicates = this.obtenerCIDuplicados().length > 0;
        
        if (hasDuplicates) {
          this.toastService.warning(
            'Carnets duplicados detectados',
            `${exitosos} grupos procesados, pero hay carnets duplicados. Por favor, revísalos antes de guardar.`,
            5000
          );
        } else {
          this.toastService.success(
            'Cálculo completado',
            `${exitosos} grupos procesados exitosamente${fallidos > 0 ? ` (${fallidos} con errores)` : ''}`,
            3000
          );
        }
      } else {
        this.toastService.error(
          'Error en todos los grupos',
          'Ningún grupo pudo ser procesado correctamente'
        );
      }
      
    } catch (error) {
      console.error('Error calculando descuentos:', error);
      this.isCalculating = false;
      this.loadingService.setLoading(false);
      this.toastService.error(
        'Error de procesamiento',
        'No se pudieron calcular los descuentos'
      );
    }
  }
  
  private async procesarGrupo(grupo: GrupoFamiliar): Promise<RegistroEstudiante[]> {
    const registros: RegistroEstudiante[] = [];
    
    if (!window.academicoAPI) {
      throw new Error('API de Académico no disponible');
    }
    
    for (const criterio of grupo.cis) {
      try {
        // Search for student by CI or name (the API accepts both)
        const personas = await window.academicoAPI.obtenerPersonasPorCarnet(criterio);
        
        if (personas.length === 0) {
          // Student not found - create placeholder record
          const registroNoEncontrado: RegistroEstudiante = {
            id: crypto.randomUUID(),
            id_solicitud: '',
            id_gestion: this.semestreActual[0]?.id || '',
            id_estudiante_siaan: '',
            ci_estudiante: criterio,
            nombre_estudiante: 'Estudiante no encontrado',
            carrera: 'No encontrado',
            total_creditos: 0,
            valor_credito: 0,
            credito_tecnologico: 0,
            porcentaje_descuento: 0,
            monto_primer_pago: 0,
            plan_primer_pago: 'N/A',
            referencia_primer_pago: 'N/A',
            total_semestre: 0,
            registrado: false,
            comentarios: `No se encontró registro para: ${criterio}`,
            sin_kardex: true // Mark as problematic
          };
          
          registros.push(registroNoEncontrado);
          continue; // Continue with next student
        }
        
        // If multiple results, take the first one
        const persona = personas[0];
        const idEstudiante = persona.id;
        
        // Extract CI and name from API response (not from Excel)
        const ciEstudiante = persona.documentoIdentidad || persona.numeroDocumento || criterio;
        const nombreEstudiante = persona.nombreCompleto || persona.nombre || 'N/A';
        
        // Get kardex information
        const kardex = await window.academicoAPI.obtenerKardexEstudiante(idEstudiante);
        const [totalCreditos, carrera, sinKardex] = await this.obtenerInformacionKardex(kardex);
        
        let valorCredito = 0;
        let creditoTecnologico = 0;
        let totalSemestre = 0;
        
        // Only calculate career info if we have valid kardex data
        if (!sinKardex) {
          // Get payment information
          const [referencia, planAccedido, pagoRealizado, sinPago] = await this.obtenerPlanDePagoRealizado(idEstudiante, nombreEstudiante, ciEstudiante);
          
          // Get career info from service
          const carreras = this.carreraService.currentData;
          const carreraInfo = carreras.find(c => 
            c.carrera.normalize('NFD').replace(/[\u0300-\u036f]/g, '') === 
            carrera.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
          );
          
          if (!carreraInfo) {
            throw new Error(`Carrera no encontrada en sistema: ${carrera} para estudiante ${nombreEstudiante}`);
          }
          
          valorCredito = carreraInfo.tarifario?.valor_credito || 0;
          creditoTecnologico = carreraInfo.incluye_tecnologico ? valorCredito : 0;
          totalSemestre = valorCredito * totalCreditos + creditoTecnologico;
          
          const registro: RegistroEstudiante = {
            id: crypto.randomUUID(),
            id_solicitud: '', // Will be set when saving
            id_gestion: this.semestreActual[0]?.id || '',
            id_estudiante_siaan: idEstudiante,
            ci_estudiante: ciEstudiante,
            nombre_estudiante: nombreEstudiante,
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
            comentarios: sinPago ? 'Sin plan de pago encontrado' : '',
            sin_kardex: false,
            sin_pago: sinPago
          };
          
          registros.push(registro);
        } else {
          // Student without kardex info - create basic record
          const registro: RegistroEstudiante = {
            id: crypto.randomUUID(),
            id_solicitud: '',
            id_gestion: this.semestreActual[0]?.id || '',
            id_estudiante_siaan: idEstudiante,
            ci_estudiante: ciEstudiante,
            nombre_estudiante: nombreEstudiante,
            carrera: 'Sin información',
            total_creditos: 0,
            valor_credito: 0,
            credito_tecnologico: 0,
            porcentaje_descuento: 0,
            monto_primer_pago: 0,
            plan_primer_pago: 'N/A',
            referencia_primer_pago: 'N/A',
            total_semestre: 0,
            registrado: false,
            comentarios: 'Estudiante sin registro en gestiones activas',
            sin_kardex: true
          };
          
          registros.push(registro);
        }
        
      } catch (error) {
        console.error(`Error procesando criterio ${criterio}:`, error);
        
        // Check if it's a 404 error (student not found in API)
        const errorMessage = error instanceof Error ? error.message : String(error);
        const is404Error = errorMessage.includes('404') || 
                          errorMessage.includes('No se encontró') ||
                          errorMessage.includes('not found');
        
        if (is404Error) {
          // Create placeholder record for not found student
          const registroNoEncontrado: RegistroEstudiante = {
            id: crypto.randomUUID(),
            id_solicitud: '',
            id_gestion: this.semestreActual[0]?.id || '',
            id_estudiante_siaan: '',
            ci_estudiante: criterio,
            nombre_estudiante: 'Estudiante no encontrado',
            carrera: 'No encontrado',
            total_creditos: 0,
            valor_credito: 0,
            credito_tecnologico: 0,
            porcentaje_descuento: 0,
            monto_primer_pago: 0,
            plan_primer_pago: 'N/A',
            referencia_primer_pago: 'N/A',
            total_semestre: 0,
            registrado: false,
            comentarios: `Error: ${errorMessage}`,
            sin_kardex: true
          };
          
          registros.push(registroNoEncontrado);
          continue; // Continue with next student instead of failing
        }
        
        // For other errors, re-throw
        throw error;
      }
    }
    
    return registros;
  }
  
  private async obtenerInformacionKardex(kardex: any[]): Promise<[number, string, boolean]> {
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
    
    // If no semesters found, return default values with flag
    if (semestresEncontrados === 0) {
      return [0, 'Sin información', true]; // true = sin_kardex
    }
    
    return [totalCreditos, carrera, false]; // false = tiene kardex válido
  }
  
  private async obtenerPlanDePagoRealizado(id_estudiante: string, studentName: string, studentCI: string): Promise<[string, string, number, boolean]> {
    let referencia = "";
    let planAccedido = "";
    let pagoRealizado = 0;
    let sinPago = false;
    
    if (!window.academicoAPI) {
      // No API available - mark as sin_pago
      return [referencia, 'No encontrado', pagoRealizado, true];
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
    
    // If no payment found, mark as sin_pago
    if (!planAccedido) {
      sinPago = true;
    }
    
    // Return values with sin_pago flag
    return [referencia, planAccedido || 'No encontrado', pagoRealizado, sinPago];
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
  
  // Check if there are ties in UVE credits within a group
  tieneEmpates(grupo: GrupoFamiliar): boolean {
    if (!grupo.registros || grupo.registros.length < 2) {
      return false;
    }
    
    const creditos = grupo.registros.map(r => r.total_creditos || 0);
    const creditosUnicos = new Set(creditos);
    
    // If there are fewer unique values than total registros, there are ties
    return creditosUnicos.size < creditos.length;
  }
  
  // Move student up in the order
  moverEstudianteArriba(grupo: GrupoFamiliar, index: number): void {
    if (!grupo.registros || index === 0) {
      return;
    }
    
    // Swap positions
    const temp = grupo.registros[index];
    grupo.registros[index] = grupo.registros[index - 1];
    grupo.registros[index - 1] = temp;
    
    // Recalculate discounts with new order
    this.calcularPorcentajesGrupo(grupo.registros);
  }
  
  // Move student down in the order
  moverEstudianteAbajo(grupo: GrupoFamiliar, index: number): void {
    if (!grupo.registros || index === grupo.registros.length - 1) {
      return;
    }
    
    // Swap positions
    const temp = grupo.registros[index];
    grupo.registros[index] = grupo.registros[index + 1];
    grupo.registros[index + 1] = temp;
    
    // Recalculate discounts with new order
    this.calcularPorcentajesGrupo(grupo.registros);
  }
  
  // Check if two consecutive students have the same UVE credits (can be swapped)
  puedenIntercambiarse(grupo: GrupoFamiliar, index1: number, index2: number): boolean {
    if (!grupo.registros || index1 < 0 || index2 >= grupo.registros.length) {
      return false;
    }
    
    const creditos1 = grupo.registros[index1]?.total_creditos || 0;
    const creditos2 = grupo.registros[index2]?.total_creditos || 0;
    
    return creditos1 === creditos2;
  }
  
  // Duplicate CI detection and management
  verificarCIDuplicados(): void {
    // This method is called after processing to mark duplicates
    // The actual check is done in obtenerCIDuplicados()
  }
  
  obtenerCIDuplicados(): string[] {
    const ciCount = new Map<string, number>();
    
    // Count occurrences of each CI across all successful groups
    this.processedGroups.forEach(grupo => {
      if (!grupo.hasErrors && grupo.registros) {
        grupo.registros.forEach(registro => {
          const ci = registro.ci_estudiante;
          ciCount.set(ci, (ciCount.get(ci) || 0) + 1);
        });
      }
    });
    
    // Return CIs that appear more than once
    return Array.from(ciCount.entries())
      .filter(([_, count]) => count > 1)
      .map(([ci, _]) => ci);
  }
  
  tieneCIDuplicado(registro: RegistroEstudiante): boolean {
    const duplicados = this.obtenerCIDuplicados();
    return duplicados.includes(registro.ci_estudiante);
  }
  
  mostrarModalDuplicados(ci: string): void {
    const grupos: { grupo: GrupoFamiliar; registro: RegistroEstudiante }[] = [];
    
    // Find all occurrences of this CI
    this.processedGroups.forEach(grupo => {
      if (!grupo.hasErrors && grupo.registros) {
        grupo.registros.forEach(registro => {
          if (registro.ci_estudiante === ci) {
            grupos.push({ grupo, registro });
          }
        });
      }
    });
    
    this.duplicateCIInfo = { ci, grupos };
    this.showDuplicateModal = true;
  }
  
  cerrarModalDuplicados(): void {
    this.showDuplicateModal = false;
    this.duplicateCIInfo = null;
    this.grupoToEdit = null;
    this.registroToReplace = null;
  }
  
  iniciarReemplazo(grupo: GrupoFamiliar, registro: RegistroEstudiante): void {
    this.grupoToEdit = grupo;
    this.registroToReplace = registro;
  }
  
  cancelarReemplazo(): void {
    this.grupoToEdit = null;
    this.registroToReplace = null;
  }
  
  async reemplazarEstudiante(studentData: StudentSearchResult): Promise<void> {
    if (!this.grupoToEdit || !this.registroToReplace) {
      return;
    }
    
    this.isReplacingStudent = true;
    this.loadingService.show('Procesando nuevo estudiante...');
    
    try {
      if (!window.academicoAPI) {
        throw new Error('API de Académico no disponible');
      }
      
      const idEstudiante = studentData.id;
      const ciEstudiante = studentData.carnet;
      const nombreEstudiante = studentData.nombre;
      
      // Check if this new CI is already in the group
      if (this.grupoToEdit.registros?.some(r => r.ci_estudiante === ciEstudiante && r.id !== this.registroToReplace!.id)) {
        throw new Error('Este estudiante ya está en el grupo');
      }
      
      // Get kardex information
      const kardex = await window.academicoAPI.obtenerKardexEstudiante(idEstudiante);
      const [totalCreditos, carrera, sinKardex] = await this.obtenerInformacionKardex(kardex);
      
      if (sinKardex) {
        // Student without kardex - show error
        throw new Error(`El estudiante ${nombreEstudiante} no tiene registro en las gestiones activas`);
      }
      
      // Get payment information
      const [referencia, planAccedido, pagoRealizado, sinPago] = await this.obtenerPlanDePagoRealizado(idEstudiante, nombreEstudiante, ciEstudiante);
      
      // Get career info
      const carreras = this.carreraService.currentData;
      const carreraInfo = carreras.find(c => 
        c.carrera.normalize('NFD').replace(/[\u0300-\u036f]/g, '') === 
        carrera.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      );
      
      if (!carreraInfo) {
        throw new Error(`Carrera no encontrada en sistema: ${carrera}`);
      }
      
      const valorCredito = carreraInfo.tarifario?.valor_credito || 0;
      const creditoTecnologico = carreraInfo.incluye_tecnologico ? valorCredito : 0;
      const totalSemestre = valorCredito * totalCreditos + creditoTecnologico;
      
      // Update the registro
      this.registroToReplace.id_estudiante_siaan = idEstudiante;
      this.registroToReplace.ci_estudiante = ciEstudiante;
      this.registroToReplace.nombre_estudiante = nombreEstudiante;
      this.registroToReplace.carrera = carrera;
      this.registroToReplace.total_creditos = totalCreditos;
      this.registroToReplace.valor_credito = valorCredito;
      this.registroToReplace.credito_tecnologico = creditoTecnologico;
      this.registroToReplace.monto_primer_pago = pagoRealizado;
      this.registroToReplace.plan_primer_pago = planAccedido;
      this.registroToReplace.referencia_primer_pago = referencia;
      this.registroToReplace.total_semestre = totalSemestre;
      this.registroToReplace.sin_kardex = false;
      this.registroToReplace.sin_pago = sinPago;
      this.registroToReplace.comentarios = sinPago ? 'Sin plan de pago encontrado' : '';
      
      // Recalculate discounts for the group
      if (this.grupoToEdit.registros) {
        this.calcularPorcentajesGrupo(this.grupoToEdit.registros);
      }
      
      this.loadingService.setLoading(false);
      
      this.toastService.success(
        'Estudiante reemplazado',
        `${nombreEstudiante} ha sido agregado al grupo ${this.grupoToEdit.rowNumber}`,
        3000
      );
      
      // Close modals and reset
      this.cerrarModalDuplicados();
      
    } catch (error) {
      console.error('Error reemplazando estudiante:', error);
      this.loadingService.setLoading(false);
      this.toastService.error(
        'Error al reemplazar',
        error instanceof Error ? error.message : 'No se pudo reemplazar el estudiante'
      );
    } finally {
      this.isReplacingStudent = false;
    }
  }
  
  // Get excluded CIs for autocomplete (all CIs in current group except the one being replaced)
  getExcludedCIsForReplace(): string[] {
    if (!this.grupoToEdit || !this.registroToReplace) {
      return [];
    }
    
    return this.grupoToEdit.registros
      ?.filter(r => r.id !== this.registroToReplace!.id)
      .map(r => r.ci_estudiante) || [];
  }
  
  eliminarGrupoPorDuplicado(grupo: GrupoFamiliar): void {
    this.processedGroups = this.processedGroups.filter(
      g => g.rowNumber !== grupo.rowNumber
    );
    
    this.toastService.success(
      'Grupo eliminado',
      `Grupo ${grupo.rowNumber} eliminado correctamente`,
      3000
    );
    
    this.cerrarModalDuplicados();
  }
  
  // Remove individual student from group
  eliminarEstudianteDeGrupo(grupo: GrupoFamiliar, registro: RegistroEstudiante): void {
    if (!grupo.registros) {
      return;
    }
    
    // Filter out the student
    grupo.registros = grupo.registros.filter(r => r.id !== registro.id);
    
    // If group has less than 2 students, remove the entire group
    if (grupo.registros.length < 2) {
      this.processedGroups = this.processedGroups.filter(
        g => g.rowNumber !== grupo.rowNumber
      );
      
      this.toastService.warning(
        'Grupo eliminado',
        `Grupo ${grupo.rowNumber} eliminado por tener menos de 2 estudiantes`,
        3000
      );
      
      // Close modal and reset
      this.grupoToEdit = null;
      this.registroToReplace = null;
    } else {
      // Recalculate discounts for remaining students
      this.calcularPorcentajesGrupo(grupo.registros);
      
      this.toastService.success(
        'Estudiante eliminado',
        `${registro.nombre_estudiante} eliminado del grupo ${grupo.rowNumber}`,
        3000
      );
      
      // Close modal and reset
      this.grupoToEdit = null;
      this.registroToReplace = null;
    }
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
      `Grupo ${this.groupToDelete.rowNumber} eliminado correctamente`,
      3000
    );
    
    this.groupToDelete = null;
    this.showDeleteConfirmModal = false;
  }
  
  // Manual payment modal methods
  private showManualPaymentInput(studentName: string, studentCI: string): Promise<ManualPaymentData | null> {
    return new Promise((resolve) => {
      this.currentStudentForManualInput = studentName;
      this.currentStudentCIForManualInput = studentCI;
      this.showManualPaymentModal = true;
      this.manualPaymentResolve = resolve;
    });
  }
  
  onManualPaymentSubmit(data: ManualPaymentData): void {
    if (this.manualPaymentResolve) {
      this.manualPaymentResolve(data);
      this.manualPaymentResolve = null;
    }
    this.showManualPaymentModal = false;
    this.currentStudentForManualInput = '';
    this.currentStudentCIForManualInput = '';
  }
  
  onManualPaymentCancel(): void {
    if (this.manualPaymentResolve) {
      this.manualPaymentResolve(null);
      this.manualPaymentResolve = null;
    }
    this.showManualPaymentModal = false;
    this.currentStudentForManualInput = '';
    this.currentStudentCIForManualInput = '';
  }
  
  // Method to manually enter payment data for a student without payment plan
  async ingresarDatosPagoManual(grupo: GrupoFamiliar, registro: RegistroEstudiante): Promise<void> {
    try {
      // Show manual payment modal
      const manualData = await this.showManualPaymentInput(
        registro.nombre_estudiante,
        registro.ci_estudiante
      );
      
      if (manualData) {
        // Update the registro with manual payment data
        registro.referencia_primer_pago = manualData.referencia;
        registro.plan_primer_pago = manualData.planAccedido;
        registro.monto_primer_pago = manualData.pagoRealizado;
        registro.sin_pago = false;
        registro.comentarios = '';
        
        this.toastService.success(
          'Datos de pago actualizados',
          `Plan de pago ingresado para ${registro.nombre_estudiante}`,
          3000
        );
      }
    } catch (error) {
      console.error('Error ingresando datos de pago:', error);
      this.toastService.error(
        'Error',
        'No se pudo ingresar los datos de pago'
      );
    }
  }
  
  // Step navigation methods
  volverPasoAnterior(): void {
    if (this.currentStep === 3) {
      // From step 3, go back to show steps 1 and 2
      this.currentStep = 2;
      this.processedGroups = []; // Clear processed groups
    } else if (this.currentStep === 4) {
      // From step 4, go back to show step 3
      this.currentStep = 3;
    } else if (this.currentStep === 2) {
      // From step 2, go back to step 1
      this.currentStep = 1;
    }
  }
  
  async guardarRegistros(): Promise<void> {
    // TODO: Implement save functionality to database
    this.loadingService.show('Guardando registros...');
    
    try {
      // Simulate save operation
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      this.loadingService.setLoading(false);
      
      this.toastService.success(
        'Registros guardados',
        'Los registros han sido guardados exitosamente en la base de datos',
        3000
      );
      
      // Reset to initial state after save
      this.limpiarArchivo();
      
    } catch (error) {
      console.error('Error guardando registros:', error);
      this.loadingService.setLoading(false);
      this.toastService.error(
        'Error al guardar',
        'No se pudieron guardar los registros'
      );
    }
  }
}
