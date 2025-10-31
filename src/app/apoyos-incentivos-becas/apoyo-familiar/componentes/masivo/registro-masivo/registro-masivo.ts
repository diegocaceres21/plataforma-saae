import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ToastService } from '../../../../../shared/servicios/toast';
import { ToastContainerComponent } from '../../../../../shared/componentes/toast-container/toast-container';
import { LoadingService } from '../../../../../shared/servicios/loading';
import { ApoyoFamiliarService } from '../../../../servicios/apoyo-familiar.service';
import { CarreraService } from '../../../../servicios/carrera.service';
import { BeneficioService } from '../../../../servicios/beneficio.service';
import { GestionService } from '../../../../servicios/gestion.service';
import { AcademicoUtilsService } from '../../../../servicios/academico-utils.service';
import { Gestion } from '../../../../interfaces/gestion';
import { RegistroEstudiante } from '../../../../interfaces/registro-estudiante';
import { StudentAutocompleteComponent } from '../../../../../shared/componentes/student-autocomplete/student-autocomplete';
import { StudentSearchResult } from '../../../../../shared/interfaces/student-search';
import { ManualPaymentModalComponent, ManualPaymentData } from '../../shared/manual-payment-modal/manual-payment-modal';
import * as XLSX from 'xlsx';
import '../../../../../shared/interfaces/electron-api';

interface EstudianteCriterio {
  carnet?: string;
  nombre?: string;
}

interface GrupoFamiliar {
  rowNumber: number;
  estudiantes: EstudianteCriterio[];
  registros?: RegistroEstudiante[];
  hasErrors?: boolean;
  errorMessage?: string;
}

interface ResultadoGuardadoGrupo {
  grupo: GrupoFamiliar;
  exito: boolean;
  id_solicitud?: string;
  estudiantes_guardados?: number;
  error?: string;
  detalles?: string;
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
  private beneficioService = inject(BeneficioService);
  private gestionService = inject(GestionService);
  private academicoUtils = inject(AcademicoUtilsService);

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

  // Add student to group modal
  showAgregarEstudianteModal = false;
  grupoParaAgregar: GrupoFamiliar | null = null;
  excludedCIsForAgregar: string[] = [];
  isAddingStudent = false;

  // Delete student confirmation modal
  showDeleteStudentModal = false;
  estudianteToDelete: RegistroEstudiante | null = null;
  grupoToDeleteFrom: GrupoFamiliar | null = null;

  // Save results modal
  showResumenModal = false;
  resultadosGuardado: ResultadoGuardadoGrupo[] = [];
  mostrarDetallesError: { [key: number]: boolean } = {};

  // Missing career resolution modal
  showSelectCarreraModal = false;
  grupoParaSeleccionarCarrera: GrupoFamiliar | null = null;
  registroParaSeleccionarCarrera: RegistroEstudiante | null = null;
  carreraSeleccionadaId: string | null = null;

  async ngOnInit() {
    await this.gestionService.loadGestionData();
    this.semestreActual = this.gestionService.getActiveGestiones();

    // Ensure carreras are loaded for selection modal
    try {
      await this.carreraService.loadCarreraData?.();
    } catch (e) {
      // fallback silently; data might be provided by APP_INITIALIZER
    }

    // Cargar beneficios para obtener ID de "APOYO FAMILIAR"
    try {
      await this.beneficioService.loadBeneficioData();
    } catch (e) {
      console.error('Error loading beneficios:', e);
    }

    if (this.semestreActual.length === 0) {
      console.warn('No se encontraron gestiones activas');
    }
  }

  descargarPlantilla(): void {
    try {
      // Create workbook with template structure
      const wb = XLSX.utils.book_new();

      // Define template headers - 2 columns per student (carnet and nombre)
      const headers = [
        'Carnet Hermano 1', 'Nombre Hermano 1',
        'Carnet Hermano 2', 'Nombre Hermano 2',
        'Carnet Hermano 3', 'Nombre Hermano 3',
        'Carnet Hermano 4', 'Nombre Hermano 4',
        'Carnet Hermano 5', 'Nombre Hermano 5'
      ];

      // Create worksheet from headers
      const ws = XLSX.utils.aoa_to_sheet([headers]);

      // Set column widths - narrower for carnets, wider for names
      ws['!cols'] = [
        { wch: 15 }, { wch: 25 }, // Hermano 1
        { wch: 15 }, { wch: 25 }, // Hermano 2
        { wch: 15 }, { wch: 25 }, // Hermano 3
        { wch: 15 }, { wch: 25 }, // Hermano 4
        { wch: 15 }, { wch: 25 }  // Hermano 5
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

          // Extract estudiantes from row - 2 columns per student (carnet, nombre)
          const estudiantes: EstudianteCriterio[] = [];
          for (let studentIndex = 0; studentIndex < 5; studentIndex++) {
            const carnetCol = studentIndex * 2; // Columns 0, 2, 4, 6, 8
            const nombreCol = studentIndex * 2 + 1; // Columns 1, 3, 5, 7, 9

            const carnet = row[carnetCol] !== undefined && row[carnetCol] !== null && String(row[carnetCol]).trim() !== ''
              ? String(row[carnetCol]).trim()
              : undefined;
            const nombre = row[nombreCol] !== undefined && row[nombreCol] !== null && String(row[nombreCol]).trim() !== ''
              ? String(row[nombreCol]).trim()
              : undefined;

            // Only add student if at least one field (carnet or nombre) is provided
            if (carnet || nombre) {
              estudiantes.push({ carnet, nombre });
            }
          }

          // Only add groups with at least 2 students
          if (estudiantes.length >= 2) {
            this.uploadedGroups.push({
              rowNumber: i,
              estudiantes
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
      // OPTIMIZATION 1: Pre-load carreras into a Map for O(1) lookups
      const carrerasMap = new Map<string, any>();
      this.carreraService.currentData.forEach((c: any) => {
        const carreraNormalized = c.carrera.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
        carrerasMap.set(carreraNormalized, c);
      });

      // OPTIMIZATION 2: Process groups in parallel batches
      const BATCH_SIZE = 5; // Process 5 groups at a time
      const totalGrupos = this.uploadedGroups.length;

      for (let i = 0; i < this.uploadedGroups.length; i += BATCH_SIZE) {
        const batch = this.uploadedGroups.slice(i, i + BATCH_SIZE);
        
        // Update loading message with progress (without calling show() again)
        const progreso = Math.min(i + BATCH_SIZE, totalGrupos);
        this.loadingService['messageSubject'].next(`Procesando grupos... (${progreso}/${totalGrupos})`);

        // Process batch in parallel
        const results = await Promise.allSettled(
          batch.map(grupo => this.procesarGrupoOptimizado(grupo, carrerasMap))
        );

        // Process results
        results.forEach((result, index) => {
          const grupo = batch[index];
          
          if (result.status === 'fulfilled') {
            const registros = result.value;
            this.calcularPorcentajesGrupo(registros);
            
            this.processedGroups.push({
              ...grupo,
              registros,
              hasErrors: false
            });
          } else {
            console.error(`Error procesando grupo ${grupo.rowNumber}:`, result.reason);
            this.processedGroups.push({
              ...grupo,
              hasErrors: true,
              errorMessage: result.reason instanceof Error ? result.reason.message : 'Error desconocido'
            });
          }
        });
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

  private async procesarGrupoOptimizado(grupo: GrupoFamiliar, carrerasMap: Map<string, any>): Promise<RegistroEstudiante[]> {
    const registros: RegistroEstudiante[] = [];

    if (!window.academicoAPI) {
      throw new Error('API de Académico no disponible');
    }

    for (const estudiante of grupo.estudiantes) {
      // Definir criterio de búsqueda para mensajes de error
      let criterioBusqueda = '';
      if (estudiante.carnet && estudiante.nombre) {
        criterioBusqueda = `${estudiante.carnet} (${estudiante.nombre})`;
      } else {
        criterioBusqueda = estudiante.carnet || estudiante.nombre || 'Sin criterio';
      }

      try {
        // Búsqueda prioritaria: primero por carnet, luego por nombre
        let personas: any[] = [];
        let encontradoPor: 'carnet' | 'nombre' | undefined;

        // 1. Intentar búsqueda por carnet si está disponible
        if (estudiante.carnet && estudiante.carnet.trim() !== '') {
          personas = await window.academicoAPI.obtenerPersonasPorCarnet(estudiante.carnet.trim());
          if (personas.length > 0) {
            encontradoPor = 'carnet';
          }
        }

        // 2. Si no encontró por carnet, intentar por nombre completo
        if (personas.length === 0 && estudiante.nombre && estudiante.nombre.trim() !== '') {
          personas = await window.academicoAPI.obtenerPersonasPorCarnet(estudiante.nombre.trim());
          if (personas.length > 0) {
            encontradoPor = 'nombre';
          }
        }

        if (personas.length === 0) {
          // Student not found - create placeholder record
          const registroNoEncontrado: RegistroEstudiante = {
            id: crypto.randomUUID(),
            id_solicitud: '',
            id_gestion: this.semestreActual[0]?.id || '',
            id_estudiante_siaan: '',
            ci_estudiante: estudiante.carnet || criterioBusqueda,
            nombre_estudiante: estudiante.nombre || 'Estudiante no encontrado',
            carrera: 'No encontrado', // Solo para mostrar en UI
            id_carrera: undefined, // No hay carrera asignada
            id_beneficio: this.beneficioService.getApoyoFamiliarId(), // ID del beneficio "APOYO FAMILIAR"
            total_creditos: 0,
            valor_credito: 0,
            credito_tecnologico: 0,
            porcentaje_descuento: 0,
            monto_primer_pago: 0,
            plan_primer_pago: 'N/A',
            referencia_primer_pago: 'N/A',
            total_semestre: 0,
            registrado: false,
            comentarios: `No se encontró registro para: ${criterioBusqueda}`,
            sin_kardex: true, // Mark as problematic
            // Criterios de búsqueda usados
            criterio_carnet: estudiante.carnet,
            criterio_nombre: estudiante.nombre,
            encontrado_por: undefined // Not found
          };

          registros.push(registroNoEncontrado);
          continue; // Continue with next student
        }

        // If multiple results, take the first one
        const persona = personas[0];
        const idEstudiante = persona.id;

        // Extract CI and name from API response (prefer API data over Excel data)
        const ciEstudiante = persona.documentoIdentidad || persona.numeroDocumento || estudiante.carnet || '';
        const nombreEstudiante = persona.nombreCompleto || persona.nombre || estudiante.nombre || 'N/A';

        // Get kardex information
        const kardex = await window.academicoAPI.obtenerKardexEstudiante(idEstudiante);
        const [totalCreditos, carrera, sinKardex] = await this.academicoUtils.obtenerInformacionKardexConFlag(kardex, this.semestreActual);

        let valorCredito = 0;
        let creditoTecnologico = 0;
        let totalSemestre = 0;

        // Only calculate career info if we have valid kardex data
        if (!sinKardex) {
          // Get payment information
          const [referencia, planAccedido, pagoRealizado, sinPago, pagosSemestre, pagoCreditoTecnologico] = await this.academicoUtils.obtenerPlanDePagoRealizado(idEstudiante, this.semestreActual);

          // OPTIMIZATION: O(1) lookup from map instead of O(n) find
          const carreraNormalized = carrera.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
          const carreraInfo = carrerasMap.get(carreraNormalized);

          if (!carreraInfo) {
            // Carrera del kardex no coincide con BD: marcar para selección
            const registro: RegistroEstudiante = {
              id: crypto.randomUUID(),
              id_solicitud: '', // Will be set when saving
              id_gestion: this.semestreActual[0]?.id || '',
              id_estudiante_siaan: idEstudiante,
              ci_estudiante: ciEstudiante,
              nombre_estudiante: nombreEstudiante,
              carrera, // Texto del kardex para referencia en UI
              id_carrera: undefined, // No hay carrera asignada aún
              id_beneficio: this.beneficioService.getApoyoFamiliarId(), // ID del beneficio "APOYO FAMILIAR"
              total_creditos: totalCreditos,
              valor_credito: 0,
              credito_tecnologico: 0,
              porcentaje_descuento: 0, // Will be calculated
              monto_primer_pago: pagoRealizado,
              plan_primer_pago: planAccedido,
              referencia_primer_pago: referencia,
              pagos_realizados: pagosSemestre,
              pago_credito_tecnologico: pagoCreditoTecnologico,
              total_semestre: 0,
              registrado: false,
              comentarios: 'Carrera no encontrada en BD. Seleccione manualmente.',
              sin_kardex: false,
              sin_pago: sinPago,
              sin_carrera: true,
              // Criterios de búsqueda usados
              criterio_carnet: estudiante.carnet,
              criterio_nombre: estudiante.nombre,
              encontrado_por: encontradoPor
            };

            registros.push(registro);
          } else {
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
            carrera: carreraInfo.carrera, // Solo para mostrar en UI
            id_carrera: carreraInfo.id, // Campo principal para BD
            id_beneficio: this.beneficioService.getApoyoFamiliarId(), // ID del beneficio "APOYO FAMILIAR"
            total_creditos: totalCreditos,
            valor_credito: valorCredito,
            credito_tecnologico: creditoTecnologico,
            porcentaje_descuento: 0, // Will be calculated
            monto_primer_pago: pagoRealizado,
            plan_primer_pago: planAccedido,
            referencia_primer_pago: referencia,
            pagos_realizados: pagosSemestre,
            pago_credito_tecnologico: pagoCreditoTecnologico,
            total_semestre: totalSemestre,
            registrado: false,
            comentarios: sinPago ? 'Sin plan de pago encontrado' : '',
            sin_kardex: false,
              sin_pago: sinPago,
            // Criterios de búsqueda usados
            criterio_carnet: estudiante.carnet,
            criterio_nombre: estudiante.nombre,
            encontrado_por: encontradoPor
            };

            registros.push(registro);
          }
        } else {
          // Student without kardex info - create basic record
          const registro: RegistroEstudiante = {
            id: crypto.randomUUID(),
            id_solicitud: '',
            id_gestion: this.semestreActual[0]?.id || '',
            id_estudiante_siaan: idEstudiante,
            ci_estudiante: ciEstudiante,
            nombre_estudiante: nombreEstudiante,
            carrera: 'Sin información', // Solo para mostrar en UI
            id_carrera: undefined, // No hay carrera asignada
            id_beneficio: this.beneficioService.getApoyoFamiliarId(), // ID del beneficio "APOYO FAMILIAR"
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
            sin_kardex: true,
            // Criterios de búsqueda usados
            criterio_carnet: estudiante.carnet,
            criterio_nombre: estudiante.nombre,
            encontrado_por: encontradoPor
          };

          registros.push(registro);
        }

      } catch (error) {
        console.error(`Error procesando estudiante ${criterioBusqueda}:`, error);

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
            ci_estudiante: estudiante.carnet || criterioBusqueda,
            nombre_estudiante: estudiante.nombre || 'Estudiante no encontrado',
            carrera: 'No encontrado', // Solo para mostrar en UI
            id_carrera: undefined, // No hay carrera asignada
            id_beneficio: this.beneficioService.getApoyoFamiliarId(), // ID del beneficio "APOYO FAMILIAR"
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
            sin_kardex: true,
            // Criterios de búsqueda usados
            criterio_carnet: estudiante.carnet,
            criterio_nombre: estudiante.nombre,
            encontrado_por: undefined // Error occurred
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

  obtenerSaldoConDescuento(registro: RegistroEstudiante): number {
    registro.creditos_descuento = registro.total_creditos!; // Inicialmente, todos los créditos son con descuento
    const derechosAcademicosConDescuento = registro.creditos_descuento! * (registro.valor_credito || 0) * (1 - (registro.porcentaje_descuento || 0)) + (registro.valor_credito || 0) * (registro.total_creditos! - registro.creditos_descuento!);
    const totalConDescuento = derechosAcademicosConDescuento + (registro.credito_tecnologico || 0);
    const saldoConDescuento = totalConDescuento - (registro.monto_primer_pago || 0) - (registro.pagos_realizados || 0) - (registro.pago_credito_tecnologico ? registro.credito_tecnologico! : 0);
    return saldoConDescuento;
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
      const [totalCreditos, carrera, sinKardex] = await this.academicoUtils.obtenerInformacionKardexConFlag(kardex, this.semestreActual);

      if (sinKardex) {
        // Student without kardex - show error
        throw new Error(`El estudiante ${nombreEstudiante} no tiene registro en las gestiones activas`);
      }

      // Get payment information
      const [referencia, planAccedido, pagoRealizado, sinPago, pagosSemestre, pagoCreditoTecnologico] = await this.academicoUtils.obtenerPlanDePagoRealizado(idEstudiante, this.semestreActual);

      // Get career info
      const carreras = this.carreraService.currentData;
      const carreraInfo = carreras.find(c =>
        c.carrera.normalize('NFD').replace(/[\u0300-\u036f]/g, '') ===
        carrera.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      );

      // Update the registro
      this.registroToReplace.id_estudiante_siaan = idEstudiante;
      this.registroToReplace.ci_estudiante = ciEstudiante;
      this.registroToReplace.nombre_estudiante = nombreEstudiante;
      this.registroToReplace.carrera = carrera; // texto desde kardex
      this.registroToReplace.total_creditos = totalCreditos;
      this.registroToReplace.monto_primer_pago = pagoRealizado;
      this.registroToReplace.plan_primer_pago = planAccedido;
      this.registroToReplace.referencia_primer_pago = referencia;
      this.registroToReplace.pagos_realizados = pagosSemestre; // reset pagos realizados
      this.registroToReplace.pago_credito_tecnologico = pagoCreditoTecnologico; // reset pago crédito tecnológico
      this.registroToReplace.sin_kardex = false;
      this.registroToReplace.sin_pago = sinPago;
      this.registroToReplace.comentarios = sinPago ? 'Sin plan de pago encontrado' : '';

      if (!carreraInfo) {
        // Marcar para selección de carrera
        this.registroToReplace.valor_credito = 0;
        this.registroToReplace.credito_tecnologico = 0;
        this.registroToReplace.total_semestre = 0;
        this.registroToReplace.sin_carrera = true;
      } else {
        const valorCredito = carreraInfo.tarifario?.valor_credito || 0;
        const creditoTecnologico = carreraInfo.incluye_tecnologico ? valorCredito : 0;
        const totalSemestre = valorCredito * totalCreditos + creditoTecnologico;
        this.registroToReplace.valor_credito = valorCredito;
        this.registroToReplace.credito_tecnologico = creditoTecnologico;
        this.registroToReplace.total_semestre = totalSemestre;
        this.registroToReplace.sin_carrera = false;
      }

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

  // Delete student confirmation methods
  confirmarEliminarEstudiante(grupo: GrupoFamiliar, registro: RegistroEstudiante): void {
    this.grupoToDeleteFrom = grupo;
    this.estudianteToDelete = registro;
    this.showDeleteStudentModal = true;
  }

  cancelarEliminarEstudiante(): void {
    this.showDeleteStudentModal = false;
    this.estudianteToDelete = null;
    this.grupoToDeleteFrom = null;
  }

  ejecutarEliminarEstudiante(): void {
    if (!this.grupoToDeleteFrom || !this.estudianteToDelete) {
      return;
    }

    this.eliminarEstudianteDeGrupo(this.grupoToDeleteFrom, this.estudianteToDelete);
  }

  // Remove individual student from group
  eliminarEstudianteDeGrupo(grupo: GrupoFamiliar, registro: RegistroEstudiante): void {
    if (!grupo.registros) {
      return;
    }

    // Filter out the student
    grupo.registros = grupo.registros.filter(r => r.id !== registro.id);

    // If group has no students left, remove the entire group
    if (grupo.registros.length === 0) {
      this.processedGroups = this.processedGroups.filter(
        g => g.rowNumber !== grupo.rowNumber
      );

      this.toastService.warning(
        'Grupo eliminado',
        `Grupo ${grupo.rowNumber} eliminado porque no tiene estudiantes`,
        3000
      );
    } else {
      // Recalculate discounts for remaining students
      this.calcularPorcentajesGrupo(grupo.registros);

      this.toastService.success(
        'Estudiante eliminado',
        `${registro.nombre_estudiante} eliminado del grupo ${grupo.rowNumber}`,
        3000
      );
    }

    // Close modal and reset
    this.showDeleteStudentModal = false;
    this.estudianteToDelete = null;
    this.grupoToDeleteFrom = null;
    this.grupoToEdit = null;
    this.registroToReplace = null;
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
        if (registro.pagos_realizados && registro.pagos_realizados > 0) {
          registro.pagos_realizados -= manualData.pagoRealizado;
        }

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

  // Add student to existing group methods
  iniciarAgregarEstudiante(grupo: GrupoFamiliar): void {
    if (!grupo.registros) {
      return;
    }

    // Get all CIs from all groups to exclude
    const allCIs = this.processedGroups
      .filter(g => g.registros)
      .flatMap(g => g.registros!.map(r => r.ci_estudiante));

    this.grupoParaAgregar = grupo;
    this.excludedCIsForAgregar = allCIs;
    this.showAgregarEstudianteModal = true;
  }

  cerrarModalAgregarEstudiante(): void {
    this.showAgregarEstudianteModal = false;
    this.grupoParaAgregar = null;
    this.excludedCIsForAgregar = [];
    this.isAddingStudent = false;
  }

  async agregarEstudianteAGrupo(student: StudentSearchResult): Promise<void> {
    if (!this.grupoParaAgregar || !this.grupoParaAgregar.registros || this.isAddingStudent) {
      return;
    }

    this.isAddingStudent = true;
    this.loadingService.show('Agregando estudiante al grupo...');

    try {
      const idEstudiante = student.id;
      const ciEstudiante = student.carnet;
      const nombreEstudiante = student.nombre;

      if (!window.academicoAPI) {
        throw new Error('API académica no disponible');
      }

      // Get kardex information
      const kardex = await window.academicoAPI.obtenerKardexEstudiante(idEstudiante);
      const [totalCreditos, carrera, sinKardex] = await this.academicoUtils.obtenerInformacionKardexConFlag(kardex, this.semestreActual);

      if (sinKardex) {
        throw new Error(`El estudiante ${nombreEstudiante} no tiene registro en las gestiones activas`);
      }

      // Get payment information
      const [referencia, planAccedido, pagoRealizado, sinPago, pagosSemestre, pagoCreditoTecnologico] = await this.academicoUtils.obtenerPlanDePagoRealizado(
        idEstudiante,
        this.semestreActual
      );

      // Get career info
      const carreras = this.carreraService.currentData;
      const carreraInfo = carreras.find(c =>
        c.carrera.normalize('NFD').replace(/[\u0300-\u036f]/g, '') ===
        carrera.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      );

      // Create new registro
      const nuevoRegistro: RegistroEstudiante = {
        id: crypto.randomUUID(),
        id_solicitud: '',
        id_gestion: this.semestreActual[0]?.id || '',
        id_estudiante_siaan: idEstudiante,
        ci_estudiante: ciEstudiante,
        nombre_estudiante: nombreEstudiante,
        carrera,
        total_creditos: totalCreditos,
        valor_credito: carreraInfo?.tarifario?.valor_credito || 0,
        credito_tecnologico: carreraInfo?.incluye_tecnologico ? (carreraInfo.tarifario?.valor_credito || 0) : 0,
        porcentaje_descuento: 0,
        monto_primer_pago: pagoRealizado,
        plan_primer_pago: planAccedido,
        referencia_primer_pago: referencia,
        pagos_realizados: pagosSemestre,
        pago_credito_tecnologico: pagoCreditoTecnologico,
        total_semestre: carreraInfo ? ((carreraInfo.tarifario?.valor_credito || 0) * totalCreditos + (carreraInfo.incluye_tecnologico ? (carreraInfo.tarifario?.valor_credito || 0) : 0)) : 0,
        registrado: false,
        comentarios: sinPago ? 'Sin plan de pago encontrado' : '',
        sin_kardex: false,
        sin_pago: sinPago,
        sin_carrera: !carreraInfo
      };

      // Add to group
      this.grupoParaAgregar.registros.push(nuevoRegistro);

      // If career missing, open selection modal immediately
      if (!carreraInfo) {
        this.loadingService.setLoading(false);
        this.abrirSeleccionCarrera(this.grupoParaAgregar, nuevoRegistro);
        this.toastService.warning(
          'Carrera no encontrada',
          'Seleccione la carrera correspondiente de la base de datos para calcular montos',
          5000
        );
        return; // wait for user action in modal
      }

      // Recalculate discounts
      this.calcularPorcentajesGrupo(this.grupoParaAgregar.registros);

      this.loadingService.setLoading(false);

      this.toastService.success(
        'Estudiante agregado',
        `${nombreEstudiante} ha sido agregado al grupo ${this.grupoParaAgregar.rowNumber}`,
        3000
      );

      // Close modal
      this.cerrarModalAgregarEstudiante();

    } catch (error) {
      console.error('Error agregando estudiante:', error);
      this.loadingService.setLoading(false);
      this.toastService.error(
        'Error al agregar',
        error instanceof Error ? error.message : 'No se pudo agregar el estudiante'
      );
    } finally {
      this.isAddingStudent = false;
    }
  }

  // Add new empty group
  agregarNuevoGrupo(): void {
    // Get next row number
    const maxRowNumber = this.processedGroups.length > 0
      ? Math.max(...this.processedGroups.map(g => g.rowNumber))
      : 0;

    const nuevoGrupo: GrupoFamiliar = {
      rowNumber: maxRowNumber + 1,
      estudiantes: [],
      registros: [],
      hasErrors: false
    };

    this.processedGroups.push(nuevoGrupo);

    // Immediately open the add student modal for this new group
    this.iniciarAgregarEstudiante(nuevoGrupo);

    this.toastService.info(
      'Nuevo grupo creado',
      `Grupo ${nuevoGrupo.rowNumber} creado. Agregue al menos 2 estudiantes.`,
      4000
    );
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

  // Validation methods for saving
  get tieneErroresEnGrupos(): boolean {
    if (this.processedGroups.length === 0) {
      return true; // No groups to save
    }

    return this.processedGroups.some(grupo => {
      if (!grupo.registros || grupo.registros.length < 2) {
        return true; // Group must have at least 2 students
      }

      return grupo.registros.some(registro =>
        registro.sin_kardex ||
        registro.sin_pago ||
        registro.sin_carrera ||
        registro.nombre_estudiante === 'Estudiante no encontrado' ||
        this.tieneCIDuplicado(registro)
      );
    });
  }

  obtenerResumenErrores(): {
    gruposConMenosDe2: number;
    estudiantesSinKardex: number;
    estudiantesSinPago: number;
    estudiantesSinCarrera: number;
    estudiantesNoEncontrados: number;
    duplicados: number;
    totalEstudiantes: number;
    totalGrupos: number;
  } {
    let gruposConMenosDe2 = 0;
    let estudiantesSinKardex = 0;
    let estudiantesSinPago = 0;
    let estudiantesSinCarrera = 0;
    let estudiantesNoEncontrados = 0;
    const cisVistos = new Set<string>();
    let duplicados = 0;
    let totalEstudiantes = 0;

    this.processedGroups.forEach(grupo => {
      if (!grupo.registros || grupo.registros.length < 2) {
        gruposConMenosDe2++;
      }

      grupo.registros?.forEach(registro => {
        totalEstudiantes++;

        if (registro.sin_kardex) {
          estudiantesSinKardex++;
        }

        if (registro.sin_pago && !registro.sin_kardex) {
          estudiantesSinPago++;
        }

        if (registro.sin_carrera && !registro.sin_kardex) {
          estudiantesSinCarrera++;
        }

        if (registro.nombre_estudiante === 'Estudiante no encontrado') {
          estudiantesNoEncontrados++;
        }

        if (cisVistos.has(registro.ci_estudiante)) {
          duplicados++;
        } else {
          cisVistos.add(registro.ci_estudiante);
        }
      });
    });

    return {
      gruposConMenosDe2,
      estudiantesSinKardex,
      estudiantesSinPago,
      estudiantesSinCarrera,
      estudiantesNoEncontrados,
      duplicados,
      totalEstudiantes,
      totalGrupos: this.processedGroups.length
    };
  }

  async guardarRegistros(): Promise<void> {
    // Validate before saving
    if (this.tieneErroresEnGrupos) {
      const resumen = this.obtenerResumenErrores();
      let mensaje = 'No se puede guardar. Errores encontrados:\n';

      if (resumen.gruposConMenosDe2 > 0) {
        mensaje += `\n• ${resumen.gruposConMenosDe2} grupo(s) con menos de 2 estudiantes`;
      }
      if (resumen.estudiantesNoEncontrados > 0) {
        mensaje += `\n• ${resumen.estudiantesNoEncontrados} estudiante(s) no encontrado(s)`;
      }
      if (resumen.estudiantesSinKardex > 0) {
        mensaje += `\n• ${resumen.estudiantesSinKardex} estudiante(s) sin kardex`;
      }
      if (resumen.estudiantesSinPago > 0) {
        mensaje += `\n• ${resumen.estudiantesSinPago} estudiante(s) sin plan de pago`;
      }
      if (resumen.duplicados > 0) {
        mensaje += `\n• ${resumen.duplicados} estudiante(s) duplicado(s)`;
      }

      this.toastService.error(
        'No se puede guardar',
        'Por favor, corrija todos los errores antes de guardar',
        5000
      );

      return;
    }

    if (!window.academicoAPI) {
      this.toastService.error(
        'Error',
        'API de base de datos no disponible'
      );
      return;
    }

    // Start saving process
    this.loadingService.show('Guardando registros en la base de datos...');
    this.resultadosGuardado = [];

    try {
      // OPTIMIZATION: Process groups in batches with controlled concurrency
      const BATCH_SIZE = 3; // Process 3 groups at a time to avoid overwhelming DB
      const totalGrupos = this.processedGroups.length;

      for (let i = 0; i < this.processedGroups.length; i += BATCH_SIZE) {
        const batch = this.processedGroups.slice(i, i + BATCH_SIZE);
        
        // Update loading message with progress
        const progreso = Math.min(i + BATCH_SIZE, totalGrupos);
        this.loadingService['messageSubject'].next(`Guardando grupos... (${progreso}/${totalGrupos})`);

        // Process batch in parallel
        const results = await Promise.allSettled(
          batch.map(grupo => this.guardarGrupoOptimizado(grupo))
        );

        // Process results
        results.forEach((result, index) => {
          const grupo = batch[index];
          
          if (result.status === 'fulfilled') {
            this.resultadosGuardado.push(result.value);
          } else {
            const errorMessage = result.reason instanceof Error ? result.reason.message : 'Error desconocido';
            this.resultadosGuardado.push({
              grupo: grupo,
              exito: false,
              error: 'Error al guardar el grupo',
              detalles: errorMessage
            });
            console.error(`Error guardando grupo ${grupo.rowNumber}:`, result.reason);
          }
        });
      }

      const gruposExitosos = this.resultadosGuardado.filter(r => r.exito).length;
      const gruposFallidos = this.resultadosGuardado.filter(r => !r.exito).length;

      this.loadingService.setLoading(false);

      // Show results modal
      this.showResumenModal = true;

      // Show appropriate toast
      if (gruposFallidos === 0) {
        this.toastService.success(
          'Guardado exitoso',
          `Se guardaron correctamente ${gruposExitosos} grupo(s) familiar(es)`,
          5000
        );
      } else if (gruposExitosos === 0) {
        this.toastService.error(
          'Error al guardar',
          `No se pudo guardar ningún grupo. Revise los detalles.`,
          5000
        );
      } else {
        this.toastService.warning(
          'Guardado parcial',
          `${gruposExitosos} grupo(s) guardado(s), ${gruposFallidos} fallido(s)`,
          5000
        );
      }

    } catch (error) {
      console.error('Error general guardando registros:', error);
      this.loadingService.setLoading(false);
      this.toastService.error(
        'Error al guardar',
        'Ocurrió un error inesperado durante el guardado'
      );
    }
  }

  private async guardarGrupoOptimizado(grupo: GrupoFamiliar): Promise<ResultadoGuardadoGrupo> {
    if (!grupo.registros || grupo.registros.length === 0) {
      throw new Error('Grupo sin registros');
    }

    if (!window.academicoAPI) {
      throw new Error('API no disponible');
    }

    // Create solicitud for this family group
    const solicitudData = {
      fecha: new Date().toISOString().split('T')[0],
      id_gestion: this.semestreActual[0]?.id || '',
      estado: 'PENDIENTE',
      cantidad_estudiantes: grupo.registros.length,
      comentarios: `Grupo familiar ${grupo.rowNumber}`,
      visible: true
    };

    const solicitudResult = await window.academicoAPI.createSolicitud(solicitudData);

    if (!solicitudResult || !solicitudResult.id) {
      throw new Error('No se pudo crear la solicitud');
    }

    const id_solicitud = solicitudResult.id;

    // Prepare student records with solicitud ID
    const registrosParaGuardar = grupo.registros.map(registro => ({
      id_solicitud: id_solicitud,
      id_estudiante_siaan: registro.id_estudiante_siaan,
      id_gestion: registro.id_gestion,
      ci_estudiante: registro.ci_estudiante,
      nombre_estudiante: registro.nombre_estudiante,
      id_carrera: registro.id_carrera,
      id_beneficio: registro.id_beneficio,
      valor_credito: registro.valor_credito,
      total_creditos: registro.total_creditos,
      credito_tecnologico: registro.credito_tecnologico,
      porcentaje_descuento: registro.porcentaje_descuento,
      monto_primer_pago: registro.monto_primer_pago,
      plan_primer_pago: registro.plan_primer_pago,
      referencia_primer_pago: registro.referencia_primer_pago,
      pagos_realizados: registro.pagos_realizados,
      pago_credito_tecnologico: registro.pago_credito_tecnologico,
      total_semestre: registro.total_semestre,
      registrado: false,
      comentarios: registro.comentarios || '',
      visible: true
    }));

    // OPTIMIZATION: Use transaction-based batch insert
    const resultado = await window.academicoAPI.createMultipleWithTransaction(registrosParaGuardar);

    // Check if all students were saved successfully
    if (resultado.exitosos.length !== registrosParaGuardar.length) {
      // Partial failure
      const erroresDetallados = Object.entries(resultado.errores)
        .map(([index, error]) => `Estudiante ${parseInt(index) + 1}: ${error}`)
        .join('; ');
      
      throw new Error(`Guardado parcial: ${resultado.exitosos.length}/${registrosParaGuardar.length} exitosos. Errores: ${erroresDetallados}`);
    }

    // Success
    return {
      grupo: grupo,
      exito: true,
      id_solicitud: id_solicitud,
      estudiantes_guardados: grupo.registros.length
    };
  }

  // Results modal methods
  cerrarResumenModal(): void {
    this.showResumenModal = false;

    // If all groups were saved successfully, clean the form
    const todosExitosos = this.resultadosGuardado.every(r => r.exito);
    if (todosExitosos) {
      this.limpiarArchivo();
    }
  }

  toggleDetallesError(grupoIndex: number): void {
    this.mostrarDetallesError[grupoIndex] = !this.mostrarDetallesError[grupoIndex];
  }

  get gruposExitosos(): ResultadoGuardadoGrupo[] {
    return this.resultadosGuardado.filter(r => r.exito);
  }

  get gruposFallidos(): ResultadoGuardadoGrupo[] {
    return this.resultadosGuardado.filter(r => !r.exito);
  }

  // Careers selection helpers
  get carrerasDisponibles() {
    return this.carreraService.currentData;
  }

  abrirSeleccionCarrera(grupo: GrupoFamiliar, registro: RegistroEstudiante): void {
    this.grupoParaSeleccionarCarrera = grupo;
    this.registroParaSeleccionarCarrera = registro;
    this.carreraSeleccionadaId = null;
    this.showSelectCarreraModal = true;
  }

  cancelarSeleccionCarrera(): void {
    this.showSelectCarreraModal = false;
    this.grupoParaSeleccionarCarrera = null;
    this.registroParaSeleccionarCarrera = null;
    this.carreraSeleccionadaId = null;
  }

  confirmarSeleccionCarrera(): void {
    if (!this.grupoParaSeleccionarCarrera || !this.registroParaSeleccionarCarrera || !this.carreraSeleccionadaId) {
      return;
    }

    const selected = this.carrerasDisponibles.find(c => c.id === this.carreraSeleccionadaId!);
    if (!selected) {
      this.toastService.error('Selección inválida', 'Debe seleccionar una carrera válida');
      return;
    }

    const valorCredito = selected.tarifario?.valor_credito || 0;
    const creditoTecnologico = selected.incluye_tecnologico ? valorCredito : 0;
    const totalCreditos = this.registroParaSeleccionarCarrera.total_creditos || 0;
    const totalSemestre = valorCredito * totalCreditos + creditoTecnologico;

    // Update registro
    this.registroParaSeleccionarCarrera.carrera = selected.carrera; // Solo para mostrar en UI
    this.registroParaSeleccionarCarrera.id_carrera = selected.id; // Campo principal para BD
    this.registroParaSeleccionarCarrera.valor_credito = valorCredito;
    this.registroParaSeleccionarCarrera.credito_tecnologico = creditoTecnologico;
    this.registroParaSeleccionarCarrera.total_semestre = totalSemestre;
    this.registroParaSeleccionarCarrera.sin_carrera = false;
    this.registroParaSeleccionarCarrera.comentarios = '';

    // Recalculate discounts for the group
    if (this.grupoParaSeleccionarCarrera.registros) {
      this.calcularPorcentajesGrupo(this.grupoParaSeleccionarCarrera.registros);
    }

    this.toastService.success('Carrera asignada', 'Se actualizó la carrera y montos del estudiante');
    this.cancelarSeleccionCarrera();
  }
}
