import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import * as XLSX from 'xlsx';
import * as ExcelJS from 'exceljs';
import { ToastService } from '../../../../../shared/servicios/toast';
import { LoadingService } from '../../../../../shared/servicios/loading';
import { ToastContainerComponent } from '../../../../../shared/componentes/toast-container/toast-container';
import { StudentAutocompleteComponent } from '../../../../../shared/componentes/student-autocomplete/student-autocomplete';
import { StudentSearchResult } from '../../../../../shared/interfaces/student-search';
import { BeneficioService } from '../../../../servicios/beneficio.service';
import { GestionService } from '../../../../servicios/gestion.service';
import { CarreraService } from '../../../../servicios/carrera.service';
import { AcademicoUtilsService } from '../../../../servicios/academico-utils.service';
import { Gestion } from '../../../../interfaces/gestion';
import { RegistroEstudiante } from '../../../../interfaces/registro-estudiante';
import { Beneficio } from '../../../../interfaces/beneficio';

interface EstudianteBeneficio {
  rowNumber: number;
  nombre?: string;
  carnet?: string;
  beneficio?: string;
  porcentaje?: number;
  // Datos procesados
  registro?: RegistroEstudiante;
  hasErrors?: boolean;
  errorMessage?: string;
  // Warning when percentage differs from beneficio default
  hasWarning?: boolean;
  warningMessage?: string;
  porcentajeSugerido?: number;
  // ID del beneficio anterior que debe marcarse como inactivo
  beneficioAnteriorId?: string;
}

interface ResultadoGuardado {
  estudiante: EstudianteBeneficio;
  exito: boolean;
  id_solicitud?: string;
  error?: string;
  detalles?: string;
}

@Component({
  selector: 'app-beneficios-masivo',
  imports: [CommonModule, FormsModule, RouterLink, ToastContainerComponent, StudentAutocompleteComponent],
  templateUrl: './beneficios-masivo.html',
  styleUrl: './beneficios-masivo.scss'
})
export class BeneficiosMasivo implements OnInit {
  private toastService = inject(ToastService);
  private loadingService = inject(LoadingService);
  private beneficioService = inject(BeneficioService);
  private gestionService = inject(GestionService);
  private carreraService = inject(CarreraService);
  private academicoUtils = inject(AcademicoUtilsService);

  // Step navigation
  currentStep = 1;

  // File upload state
  selectedFile: File | null = null;
  isDragging = false;
  isProcessing = false;

  // Parsed data from Excel
  uploadedEstudiantes: EstudianteBeneficio[] = [];

  // Processing state
  isCalculating = false;
  semestreActual: Gestion[] = [];
  processedEstudiantes: EstudianteBeneficio[] = [];

  // Save results modal
  showResumenModal = false;
  resultadosGuardado: ResultadoGuardado[] = [];
  mostrarDetallesError: { [key: number]: boolean } = {};

  // Delete student confirmation modal
  showDeleteStudentModal = false;
  estudianteToDelete: EstudianteBeneficio | null = null;

  // Add student modal
  showAgregarEstudianteModal = false;
  isAddingStudent = false;
  excludedCIsForAgregar: string[] = [];
  selectedBeneficioId: string = '';
  selectedPorcentaje: number = 0;
  selectedStudent: StudentSearchResult | null = null;

  async ngOnInit() {
    await this.gestionService.loadGestionData();
    this.semestreActual = this.gestionService.getActiveGestiones();

    // Cargar carreras
    try {
      await this.carreraService.loadCarreraData?.();
    } catch (e) {
      console.error('Error loading carreras:', e);
    }

    // Cargar beneficios
    try {
      await this.beneficioService.loadBeneficioData();
    } catch (e) {
      console.error('Error loading beneficios:', e);
    }

    if (this.semestreActual.length === 0) {
      this.toastService.error('Error', 'No hay semestres activos configurados', 5000);
    }
  }

  async descargarPlantilla(): Promise<void> {
    try {
      // Obtener lista de beneficios
      const beneficios = this.beneficioService.currentData;
      const nombresBeneficios = beneficios.map((b: Beneficio) => b.nombre);

      if (nombresBeneficios.length === 0) {
        this.toastService.warning(
          'Sin beneficios',
          'No hay beneficios activos disponibles',
          3000
        );
        return;
      }

      // Crear workbook con ExcelJS
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet('Estudiantes');

      // Definir columnas
      worksheet.columns = [
        { header: 'Nombre', key: 'nombre', width: 35 },
        { header: 'Carnet', key: 'carnet', width: 15 },
        { header: 'Beneficio', key: 'beneficio', width: 35 },
        { header: 'Porcentaje', key: 'porcentaje', width: 12 }
      ];

      // Estilo para encabezados
      worksheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
      worksheet.getRow(1).fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF0070C0' }
      };
      worksheet.getRow(1).alignment = { vertical: 'middle', horizontal: 'center' };

      // Agregar filas de ejemplo
      worksheet.addRow({
        nombre: 'Juan Pérez',
        carnet: '12345678',
        beneficio: nombresBeneficios[0],
        porcentaje: 0.50
      });
      worksheet.addRow({
        nombre: 'María González',
        carnet: '87654321',
        beneficio: nombresBeneficios[1] || nombresBeneficios[0],
        porcentaje: 0.30
      });

      // Agregar validación de lista desplegable en columna Beneficio (C)
      // Aplicar desde la fila 2 hasta 1000 filas
      for (let i = 2; i <= 1000; i++) {
        worksheet.getCell(`C${i}`).dataValidation = {
          type: 'list',
          allowBlank: false,
          formulae: [`"${nombresBeneficios.join(',')}"`],
          showErrorMessage: true,
          errorStyle: 'error',
          errorTitle: 'Beneficio inválido',
          error: 'Por favor seleccione un beneficio de la lista desplegable'
        };
      }

      // Agregar validación de porcentaje en columna Porcentaje (D)
      for (let i = 2; i <= 1000; i++) {
        const cell = worksheet.getCell(`D${i}`);
        
        // Formato de porcentaje
        cell.numFmt = '0%';
        
        // Validación de datos
        cell.dataValidation = {
          type: 'decimal',
          operator: 'between',
          allowBlank: false,
          showErrorMessage: true,
          formulae: [0, 1],
          errorStyle: 'error',
          errorTitle: 'Porcentaje inválido',
          error: 'El porcentaje debe estar entre 0% y 100%'
        };
      }

      // Generar buffer y descargar
      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], { 
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' 
      });
      
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = 'plantilla_beneficios_masivo.xlsx';
      link.click();
      URL.revokeObjectURL(link.href);

      this.toastService.success(
        'Plantilla descargada',
        'Archivo generado con listas desplegables',
        3000
      );
    } catch (error) {
      console.error('Error generando plantilla:', error);
      this.toastService.error(
        'Error',
        'No se pudo generar la plantilla Excel',
        5000
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
        'Archivo inválido',
        'Por favor seleccione un archivo Excel (.xlsx o .xls)',
        5000
      );
      return;
    }

    this.selectedFile = file;
  }

  procesarArchivo(): void {
    if (!this.selectedFile) {
      this.toastService.error('Error', 'No se ha seleccionado ningún archivo', 3000);
      return;
    }

    this.isProcessing = true;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });

        // Leer la hoja de estudiantes
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][];

        // Parse estudiantes (skip header row)
        const estudiantes: EstudianteBeneficio[] = [];
        
        for (let i = 1; i < jsonData.length; i++) {
          const row = jsonData[i];
          
          // Skip empty rows
          if (!row || row.every(cell => !cell)) continue;

          const estudiante: EstudianteBeneficio = {
            rowNumber: i,
            nombre: row[0]?.toString().trim() || undefined,
            carnet: row[1]?.toString().trim() || undefined,
            beneficio: row[2]?.toString().trim() || undefined,
            porcentaje: (() => {
              const value = typeof row[3] === 'number' ? row[3] : parseFloat(row[3]);
              if (isNaN(value)) return undefined;
              // Si el valor es menor o igual a 1, asumimos que es formato decimal (0.5 = 50%)
              // Si es mayor a 1, asumimos que ya es el porcentaje (50 = 50%)
              return value > 1 ? value / 100 : value;
            })()
          };

          estudiantes.push(estudiante);
        }

        if (estudiantes.length === 0) {
          this.toastService.warning(
            'Archivo vacío',
            'No se encontraron estudiantes en el archivo Excel',
            5000
          );
          this.isProcessing = false;
          return;
        }

        this.uploadedEstudiantes = estudiantes;
        this.currentStep = 3;

      } catch (error) {
        console.error('Error parsing Excel:', error);
        this.toastService.error(
          'Error',
          'No se pudo procesar el archivo Excel. Verifique el formato.',
          5000
        );
      } finally {
        this.isProcessing = false;
      }
    };

    reader.onerror = () => {
      this.toastService.error('Error', 'Error al leer el archivo', 5000);
      this.isProcessing = false;
    };

    reader.readAsArrayBuffer(this.selectedFile);
  }

  limpiarArchivo(): void {
    this.selectedFile = null;
    this.uploadedEstudiantes = [];
    this.processedEstudiantes = [];
    this.currentStep = 1;

    // Reset file input
    const fileInput = document.getElementById('fileInput') as HTMLInputElement;
    if (fileInput) {
      fileInput.value = '';
    }
  }

  // Check if student already has a benefit in the current gestion
  async verificarBeneficioExistente(ciEstudiante: string, idGestion: string): Promise<{
    existe: boolean;
    idBeneficio?: string;
    beneficioNombre?: string;
    porcentaje?: number;
  }> {
    try {
      if (!window.academicoAPI) {
        return { existe: false };
      }

      // Use optimized endpoint that directly checks for a specific student in a specific gestion
      const registroExistente = await window.academicoAPI.checkExistingBenefit(ciEstudiante, idGestion);

      if (registroExistente) {
        // Get beneficio name
        const beneficio = this.beneficioService.currentData.find(
          (b: Beneficio) => b.id === registroExistente.id_beneficio
        );

        return {
          existe: true,
          idBeneficio: registroExistente.id_beneficio,
          beneficioNombre: beneficio?.nombre || 'Desconocido',
          porcentaje: registroExistente.porcentaje_descuento 
            ? registroExistente.porcentaje_descuento * 100 
            : 0
        };
      }

      return { existe: false };
    } catch (error) {
      console.error('Error verificando beneficio existente:', error);
      return { existe: false };
    }
  }

  async calcularDescuentos(): Promise<void> {
    if (this.uploadedEstudiantes.length === 0) {
      this.toastService.error('Error', 'No hay estudiantes para procesar', 3000);
      return;
    }

    this.isCalculating = true;
    this.loadingService.show('Procesando estudiantes...');
    this.processedEstudiantes = [];

    try {
      // OPTIMIZATION 1: Pre-load all beneficios into a Map for O(1) lookups
      const beneficiosMap = new Map<string, Beneficio>();
      this.beneficioService.currentData.forEach((b: Beneficio) => {
        beneficiosMap.set(b.nombre.toLowerCase(), b);
      });

      // OPTIMIZATION 2: Pre-load all carreras into a Map for O(1) lookups
      const carrerasMap = new Map<string, any>();
      this.carreraService.currentData.forEach((c: any) => {
        const carreraNormalized = c.carrera.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
        carrerasMap.set(carreraNormalized, c);
      });

      // OPTIMIZATION 3: Batch check existing benefits for all students at once
      const carnets = this.uploadedEstudiantes
        .filter(e => e.carnet)
        .map(e => e.carnet!.trim());
      
      const idGestionActual = this.semestreActual[0]?.id || '';
      
      let registrosExistentesMap = new Map<string, any>();
      if (window.academicoAPI && carnets.length > 0) {
        const registrosExistentes = await window.academicoAPI.checkExistingBenefitsBatch(
          carnets,
          idGestionActual
        );
        
        // Create map for O(1) lookups
        registrosExistentes.forEach((reg: any) => {
          registrosExistentesMap.set(reg.ci_estudiante, reg);
        });
      }

      // OPTIMIZATION 4: Process students in parallel batches
      const BATCH_SIZE = 10; // Process 10 students at a time
      for (let i = 0; i < this.uploadedEstudiantes.length; i += BATCH_SIZE) {
        const batch = this.uploadedEstudiantes.slice(i, i + BATCH_SIZE);
        
        // Update loading message with progress (without calling show() again)
        const progreso = Math.min(i + BATCH_SIZE, this.uploadedEstudiantes.length);
        this.loadingService['messageSubject'].next(`Procesando estudiantes... (${progreso}/${this.uploadedEstudiantes.length})`);
        
        // Process batch in parallel
        const results = await Promise.allSettled(
          batch.map(estudiante => 
            this.procesarEstudianteOptimizado(
              estudiante,
              beneficiosMap,
              carrerasMap,
              registrosExistentesMap,
              idGestionActual
            )
          )
        );

        // Add processed students
        results.forEach((result, index) => {
          this.processedEstudiantes.push(batch[index]);
        });
      }

      this.currentStep = 3;

      this.toastService.success(
        'Procesamiento completado',
        `${this.processedEstudiantes.length} estudiante(s) procesado(s)`,
        3000
      );

    } catch (error) {
      console.error('Error processing students:', error);
      this.toastService.error(
        'Error',
        'Error al procesar los estudiantes',
        5000
      );
    } finally {
      this.isCalculating = false;
      this.loadingService.hide();
    }
  }

  private async procesarEstudianteOptimizado(
    estudiante: EstudianteBeneficio,
    beneficiosMap: Map<string, Beneficio>,
    carrerasMap: Map<string, any>,
    registrosExistentesMap: Map<string, any>,
    idGestionActual: string
  ): Promise<void> {
    // Validar datos básicos
    if (!estudiante.carnet) {
      estudiante.hasErrors = true;
      estudiante.errorMessage = 'Carnet no especificado';
      return;
    }

    if (!estudiante.beneficio) {
      estudiante.hasErrors = true;
      estudiante.errorMessage = 'Beneficio no especificado';
      return;
    }

    // OPTIMIZATION: O(1) lookup instead of O(n) find
    const beneficio = beneficiosMap.get(estudiante.beneficio.toLowerCase());

    if (!beneficio) {
      estudiante.hasErrors = true;
      estudiante.errorMessage = `Beneficio "${estudiante.beneficio}" no encontrado en el sistema`;
      return;
    }

    // Autocompletar porcentaje si está vacío y el beneficio tiene descuento
    if (!estudiante.porcentaje || estudiante.porcentaje === 0) {
      if (beneficio.porcentaje && beneficio.porcentaje > 0) {
        estudiante.porcentaje = beneficio.porcentaje;
        estudiante.porcentajeSugerido = beneficio.porcentaje;
      } else {
        estudiante.hasErrors = true;
        estudiante.errorMessage = 'Porcentaje no especificado y el beneficio no tiene descuento por defecto';
        return;
      }
    }

    // Validar rango de porcentaje
    if (estudiante.porcentaje < 0 || estudiante.porcentaje > 100) {
      estudiante.hasErrors = true;
      estudiante.errorMessage = 'Porcentaje inválido (debe estar entre 0 y 100)';
      return;
    }

    // Verificar si el porcentaje difiere del porcentaje del beneficio
    let porcentajeWarning = false;
    if (beneficio.porcentaje && beneficio.porcentaje > 0) {
      const porcentajeBeneficio = beneficio.porcentaje;
      estudiante.porcentajeSugerido = porcentajeBeneficio;
      
      if (Math.abs(estudiante.porcentaje - porcentajeBeneficio) > 0.01) {
        porcentajeWarning = true;
      }
    }

    if (!window.academicoAPI) {
      estudiante.hasErrors = true;
      estudiante.errorMessage = 'API no disponible';
      return;
    }

    try {
      // Buscar estudiante por carnet
      const personas = await window.academicoAPI.obtenerPersonasPorCarnet(estudiante.carnet.trim());

      if (personas.length === 0) {
        estudiante.hasErrors = true;
        estudiante.errorMessage = `Estudiante con carnet ${estudiante.carnet} no encontrado`;
        return;
      }

      const persona = personas[0];
      const idEstudiante = persona.id;
      const ciEstudiante = persona.documentoIdentidad || persona.numeroDocumento || estudiante.carnet || '';
      const nombreEstudiante = persona.nombreCompleto || persona.nombre || estudiante.nombre || 'N/A';

      // OPTIMIZATION: O(1) lookup from pre-loaded map instead of database query
      const registroExistente = registrosExistentesMap.get(ciEstudiante);

      if (registroExistente) {
        // Check if it's the SAME benefit (ERROR) or DIFFERENT benefit (WARNING)
        if (registroExistente.id_beneficio === beneficio.id) {
          // Same benefit - this is an ERROR
          const beneficioExistenteNombre = beneficiosMap.get(
            Array.from(beneficiosMap.keys()).find(
              key => beneficiosMap.get(key)!.id === registroExistente.id_beneficio
            ) || ''
          )?.nombre || 'Desconocido';
          
          estudiante.hasErrors = true;
          estudiante.errorMessage = `Ya tiene el beneficio "${beneficioExistenteNombre}" (${(registroExistente.porcentaje_descuento * 100).toFixed(0)}%) registrado`;
          return;
        } else {
          // Different benefit - this is a WARNING (allow to continue)
          const beneficioExistenteNombre = beneficiosMap.get(
            Array.from(beneficiosMap.keys()).find(
              key => beneficiosMap.get(key)!.id === registroExistente.id_beneficio
            ) || ''
          )?.nombre || 'Otro beneficio';
          
          estudiante.hasWarning = true;
          estudiante.warningMessage = `Ya tiene "${beneficioExistenteNombre}" (${(registroExistente.porcentaje_descuento * 100).toFixed(0)}%)`;
          // Store the ID of the previous benefit to mark it as inactive later
          estudiante.beneficioAnteriorId = registroExistente.id;
          console.log(`[DETECCION] Estudiante ${nombreEstudiante} tiene beneficio anterior ID: ${registroExistente.id}`, {
            ci: ciEstudiante,
            beneficioActual: beneficio.nombre,
            beneficioAnterior: beneficioExistenteNombre,
            beneficioAnteriorId: registroExistente.id
          });
        }
      }

      // Obtener kardex
      const kardex = await window.academicoAPI.obtenerKardexEstudiante(idEstudiante);

      if (!kardex || kardex.length === 0) {
        estudiante.hasErrors = true;
        estudiante.errorMessage = 'No se encontró kardex para el estudiante';
        return;
      }

      // Obtener información del kardex
      const [totalCreditos, carrera, sinKardex] = await this.academicoUtils.obtenerInformacionKardexConFlag(kardex, this.semestreActual);

      if (sinKardex || totalCreditos === 0) {
        estudiante.hasErrors = true;
        estudiante.errorMessage = 'No tiene créditos registrados en los semestres activos';
        return;
      }

      // Obtener plan de pago realizado
      const [referencia, planAccedido, pagoRealizado, sinPago, pagosSemestre, pagoCreditoTecnologico] = await this.academicoUtils.obtenerPlanDePagoRealizado(
        idEstudiante,
        this.semestreActual
      );

      // Si no hay pago pero el descuento es 100%, usar valores predeterminados
      let referenciaFinal = referencia;
      let planAccedidoFinal = planAccedido;
      let pagoRealizadoFinal = pagoRealizado;

      if ((sinPago || pagoRealizado === 0) && estudiante.porcentaje === 1) {
        // Estudiante con 100% de descuento y sin pago - asignar valores especiales
        referenciaFinal = 'No Corresponde';
        planAccedidoFinal = 'Ninguno';
        pagoRealizadoFinal = 0;
      } else if (sinPago || pagoRealizado === 0) {
        // No hay pago y no es 100% descuento - marcar como error
        estudiante.hasErrors = true;
        estudiante.errorMessage = 'No se encontró factura de pago del semestre actual';
        return;
      }

      // OPTIMIZATION: O(1) lookup from map instead of O(n) find
      const carreraNormalized = carrera.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      const carreraInfo = carrerasMap.get(carreraNormalized);

      if (!carreraInfo) {
        estudiante.hasErrors = true;
        estudiante.errorMessage = `Carrera "${carrera}" no encontrada en el sistema`;
        return;
      }

      // Calcular valor_credito y credito_tecnologico
      const valorCredito = carreraInfo.tarifario?.valor_credito || 0;
      const creditoTecnologico = carreraInfo.incluye_tecnologico ? valorCredito : 0;

      // Crear registro
      const registro: RegistroEstudiante = {
        id: `temp-${Date.now()}-${Math.random()}`,
        id_solicitud: '',
        id_estudiante_siaan: idEstudiante,
        ci_estudiante: ciEstudiante,
        nombre_estudiante: nombreEstudiante,
        carrera: carrera,
        id_carrera: carreraInfo.id,
        id_beneficio: beneficio.id,
        total_creditos: totalCreditos,
        valor_credito: valorCredito,
        credito_tecnologico: creditoTecnologico,
        porcentaje_descuento: estudiante.porcentaje,
        monto_primer_pago: pagoRealizadoFinal,
        plan_primer_pago: planAccedidoFinal,
        pagos_realizados: pagosSemestre,
        pago_credito_tecnologico: pagoCreditoTecnologico,
        referencia_primer_pago: referenciaFinal,
        total_semestre: (valorCredito * totalCreditos) + creditoTecnologico,
        registrado: false,
        id_gestion: idGestionActual
      };

      estudiante.registro = registro;
      estudiante.hasErrors = false;

      // Set percentage warning only if there's no other warning
      if (!estudiante.hasWarning && porcentajeWarning && estudiante.porcentajeSugerido) {
        estudiante.hasWarning = true;
        estudiante.warningMessage = `Porcentaje sugerido: ${(estudiante.porcentajeSugerido * 100).toFixed(0)}% (tiene ${(estudiante.porcentaje * 100).toFixed(0)}%)`;
      }

    } catch (error) {
      console.error('Error processing student:', error);
      estudiante.hasErrors = true;
      estudiante.errorMessage = 'Error al procesar el estudiante';
    }
  }



  eliminarEstudiante(estudiante: EstudianteBeneficio): void {
    this.processedEstudiantes = this.processedEstudiantes.filter(
      e => e.rowNumber !== estudiante.rowNumber
    );

    this.toastService.success(
      'Estudiante eliminado',
      `Fila ${estudiante.rowNumber} eliminada correctamente`,
      3000
    );
  }

  volverPasoAnterior(): void {
    if (this.currentStep > 1) {
      this.currentStep--;
      
      if (this.currentStep === 1) {
        this.limpiarArchivo();
      }
    }
  }

  get tieneErroresEnEstudiantes(): boolean {
    return this.processedEstudiantes.some(e => e.hasErrors);
  }

  obtenerResumenErrores(): {
    estudiantesConError: number;
    estudiantesValidos: number;
    totalEstudiantes: number;
  } {
    const totalEstudiantes = this.processedEstudiantes.length;
    const estudiantesConError = this.processedEstudiantes.filter(e => e.hasErrors).length;
    const estudiantesValidos = totalEstudiantes - estudiantesConError;

    return {
      estudiantesConError,
      estudiantesValidos,
      totalEstudiantes
    };
  }

  async guardarRegistros(): Promise<void> {
    // Filtrar solo estudiantes válidos
    const estudiantesValidos = this.processedEstudiantes.filter(e => !e.hasErrors && e.registro);

    if (estudiantesValidos.length === 0) {
      this.toastService.error(
        'Error',
        'No hay estudiantes válidos para guardar',
        5000
      );
      return;
    }

    this.loadingService.show('Guardando registros...');
    this.resultadosGuardado = [];

    if (!window.academicoAPI) {
      this.loadingService.hide();
      this.toastService.error('Error', 'API no disponible', 5000);
      return;
    }

    try {
      // STEP 1: Mark previous benefits as inactive for students with warnings
      const estudiantesConBeneficioAnterior = estudiantesValidos.filter(
        e => e.beneficioAnteriorId && e.hasWarning
      );

      if (estudiantesConBeneficioAnterior.length > 0) {
        this.loadingService['messageSubject'].next(
          `Actualizando beneficios anteriores... (${estudiantesConBeneficioAnterior.length})`
        );

        // Update previous benefits in parallel
        const updatePromises = estudiantesConBeneficioAnterior.map(async (estudiante) => {
          try {
            console.log(`[UPDATE] Marcando como inactivo el ID: ${estudiante.beneficioAnteriorId} para ${estudiante.nombre}`);
            const result = await window.academicoAPI!.updateRegistroEstudiante(
              estudiante.beneficioAnteriorId!,
              { inactivo: true }
            );
            console.log(`[UPDATE] Éxito para ${estudiante.nombre}:`, result);
            return result;
          } catch (error) {
            console.error(
              `[UPDATE] Error marcando beneficio anterior como inactivo para ${estudiante.nombre}:`,
              error
            );
            // Continue even if one update fails
            return null;
          }
        });

        const results = await Promise.allSettled(updatePromises);
        console.log('[UPDATE] Resultados de actualización:', results);
      }

      // STEP 2: Prepare all records for batch insert
      this.loadingService['messageSubject'].next('Guardando nuevos beneficios...');
      
      const registrosParaGuardar = estudiantesValidos.map(estudiante => ({
        id_solicitud: undefined,
        id_estudiante_siaan: estudiante.registro!.id_estudiante_siaan,
        id_gestion: estudiante.registro!.id_gestion,
        ci_estudiante: estudiante.registro!.ci_estudiante,
        nombre_estudiante: estudiante.registro!.nombre_estudiante,
        id_carrera: estudiante.registro!.id_carrera,
        id_beneficio: estudiante.registro!.id_beneficio,
        valor_credito: estudiante.registro!.valor_credito,
        total_creditos: estudiante.registro!.total_creditos,
        credito_tecnologico: estudiante.registro!.credito_tecnologico,
        porcentaje_descuento: estudiante.registro!.porcentaje_descuento,
        monto_primer_pago: estudiante.registro!.monto_primer_pago,
        plan_primer_pago: estudiante.registro!.plan_primer_pago,
        pagos_realizados: estudiante.registro!.pagos_realizados ? estudiante.registro!.pagos_realizados : undefined,
        pago_credito_tecnologico: estudiante.registro!.pago_credito_tecnologico,
        referencia_primer_pago: estudiante.registro!.referencia_primer_pago,
        total_semestre: estudiante.registro!.total_semestre,
        registrado: false,
        comentarios: null,
        visible: true
      }));

      // OPTIMIZATION: Single batch insert with transaction
      const resultado = await window.academicoAPI.createMultipleWithTransaction(registrosParaGuardar);

      // Process results
      estudiantesValidos.forEach((estudiante, index) => {
        const exitoso = resultado.exitosos.includes(index);
        
        if (exitoso) {
          this.resultadosGuardado.push({
            estudiante: estudiante,
            exito: true,
            id_solicitud: resultado.ids[resultado.exitosos.indexOf(index)]?.toString(),
            error: undefined,
            detalles: undefined
          });
        } else {
          const errorMsg = resultado.errores[index] || 'Error desconocido';
          this.resultadosGuardado.push({
            estudiante: estudiante,
            exito: false,
            id_solicitud: undefined,
            error: 'Error al guardar',
            detalles: errorMsg
          });
        }
      });

      const exitosos = resultado.exitosos.length;
      const fallidos = estudiantesValidos.length - exitosos;

      this.loadingService.hide();

      // Show results modal
      this.showResumenModal = true;

      // Show summary toast
      if (fallidos === 0) {
        this.toastService.success(
          'Guardado exitoso',
          `Se guardaron ${exitosos} estudiante(s) correctamente`,
          5000
        );
      } else if (exitosos === 0) {
        this.toastService.error(
          'Error al guardar',
          `No se pudo guardar ningún estudiante. Fallaron ${fallidos}`,
          5000
        );
      } else {
        this.toastService.warning(
          'Guardado parcial',
          `${exitosos} exitoso(s), ${fallidos} fallido(s)`,
          5000
        );
      }

    } catch (error: any) {
      console.error('Error en guardado masivo:', error);
      this.loadingService.hide();
      
      // If batch transaction fails completely, mark all as failed
      estudiantesValidos.forEach(estudiante => {
        this.resultadosGuardado.push({
          estudiante: estudiante,
          exito: false,
          id_solicitud: undefined,
          error: 'Error en transacción',
          detalles: error.message || error.toString() || 'Error desconocido en la transacción'
        });
      });

      this.showResumenModal = true;
      
      this.toastService.error(
        'Error crítico',
        'Error al guardar los registros. Consulte los detalles.',
        5000
      );
    }
  }

  cerrarResumenModal(): void {
    this.showResumenModal = false;
    this.resultadosGuardado = [];
    this.mostrarDetallesError = {};
    
    // Reiniciar todo el proceso
    this.limpiarArchivo();
  }

   obtenerSaldoConDescuento(registro: RegistroEstudiante): number {
    const beneficio = this.beneficiosDisponibles.find(b => b.id === registro.id_beneficio);
    registro.creditos_descuento = beneficio?.limite_creditos ? registro.total_creditos > beneficio?.limite_creditos ? beneficio.limite_creditos : registro.total_creditos : registro.total_creditos;
    const derechosAcademicosConDescuento = registro.creditos_descuento! * (registro.valor_credito || 0) * (1 - (registro.porcentaje_descuento || 0)) + (registro.valor_credito || 0) * (registro.total_creditos! - registro.creditos_descuento!);
    const totalConDescuento = derechosAcademicosConDescuento + (registro.credito_tecnologico || 0);
    const saldoConDescuento = totalConDescuento - (registro.monto_primer_pago || 0) - (registro.pagos_realizados || 0) - (registro.pago_credito_tecnologico ? registro.credito_tecnologico! : 0);
    return saldoConDescuento;
  }

  toggleDetallesError(index: number): void {
    this.mostrarDetallesError[index] = !this.mostrarDetallesError[index];
  }

  get estudiantesExitosos(): ResultadoGuardado[] {
    return this.resultadosGuardado.filter(r => r.exito);
  }

  get estudiantesFallidos(): ResultadoGuardado[] {
    return this.resultadosGuardado.filter(r => !r.exito);
  }

  get validEstudiantesCount(): number {
    return this.processedEstudiantes.filter(e => !e.hasErrors).length;
  }

  get errorEstudiantesCount(): number {
    return this.processedEstudiantes.filter(e => e.hasErrors).length;
  }

  hasAllErrors(): boolean {
    return this.uploadedEstudiantes.length > 0 && this.uploadedEstudiantes.every(e => e.hasErrors);
  }

  // Helper: Get percentage for display (0-100 from 0-1 decimal)
  getPorcentajeDisplay(estudiante: EstudianteBeneficio): number {
    return estudiante.porcentaje ? estudiante.porcentaje * 100 : 0;
  }

  // Helper: Set percentage from display value (converts 0-100 to 0-1 decimal)
  setPorcentajeDisplay(estudiante: EstudianteBeneficio, valorDisplay: number): void {
    estudiante.porcentaje = valorDisplay / 100;
  }

  // Update percentage for a student (receives value in 0-100 range for display)
  actualizarPorcentaje(estudiante: EstudianteBeneficio, nuevoPorcentajeDisplay: number): void {
    if (nuevoPorcentajeDisplay < 0 || nuevoPorcentajeDisplay > 100) {
      this.toastService.warning(
        'Porcentaje inválido',
        'El porcentaje debe estar entre 0 y 100',
        3000
      );
      return;
    }

    // Convert to decimal (0-1)
    const porcentajeDecimal = nuevoPorcentajeDisplay / 100;
    estudiante.porcentaje = porcentajeDecimal;

    // Update registro if exists
    if (estudiante.registro) {
      estudiante.registro.porcentaje_descuento = porcentajeDecimal;
      
    }

    // Check if different from beneficio default (compare in decimal)
    if (estudiante.porcentajeSugerido && Math.abs(porcentajeDecimal - estudiante.porcentajeSugerido) > 0.0001) {
      const sugeridoDisplay = estudiante.porcentajeSugerido * 100;
      estudiante.hasWarning = true;
      estudiante.warningMessage = `El beneficio tiene un descuento del ${sugeridoDisplay}%, pero se especificó ${nuevoPorcentajeDisplay}%`;
    } else {
      estudiante.hasWarning = false;
      estudiante.warningMessage = undefined;
    }
  }

  aplicarPorcentajeSugerido(estudiante: EstudianteBeneficio): void {
    if (estudiante.porcentajeSugerido) {
      // Convert from decimal to display percentage (0-1 to 0-100)
      const sugeridoDisplay = estudiante.porcentajeSugerido * 100;
      this.actualizarPorcentaje(estudiante, sugeridoDisplay);
    }
  }

  // Delete student confirmation methods
  confirmarEliminarEstudiante(estudiante: EstudianteBeneficio): void {
    this.estudianteToDelete = estudiante;
    this.showDeleteStudentModal = true;
  }

  cancelarEliminarEstudiante(): void {
    this.showDeleteStudentModal = false;
    this.estudianteToDelete = null;
  }

  ejecutarEliminarEstudiante(): void {
    if (!this.estudianteToDelete) {
      return;
    }

    this.eliminarEstudiante(this.estudianteToDelete);
    this.showDeleteStudentModal = false;
    this.estudianteToDelete = null;
  }

  // Add student modal methods
  iniciarAgregarEstudiante(): void {
    // Get all CIs from processedEstudiantes to exclude
    const allCIs = this.processedEstudiantes
      .filter(e => e.registro)
      .map(e => e.registro!.ci_estudiante);

    this.excludedCIsForAgregar = allCIs;
    this.selectedBeneficioId = '';
    this.selectedPorcentaje = 0;
    this.selectedStudent = null;
    this.showAgregarEstudianteModal = true;
  }

  cerrarModalAgregarEstudiante(): void {
    this.showAgregarEstudianteModal = false;
    this.excludedCIsForAgregar = [];
    this.selectedBeneficioId = '';
    this.selectedPorcentaje = 0;
    this.selectedStudent = null;
    this.isAddingStudent = false;
  }

  onStudentSelected(student: StudentSearchResult): void {
    this.selectedStudent = student;
  }

  onBeneficioChange(): void {
    // Autocompletar porcentaje cuando se selecciona un beneficio
    if (this.selectedBeneficioId) {
      const beneficio = this.beneficioService.currentData.find(
        (b: Beneficio) => b.id === this.selectedBeneficioId
      );
      
      if (beneficio && beneficio.porcentaje && beneficio.porcentaje > 0) {
        // Convert decimal (0-1) to display percentage (0-100)
        this.selectedPorcentaje = beneficio.porcentaje * 100;
      }
    }
  }

  get beneficiosDisponibles() {
    return this.beneficioService.currentData;
  }

  get puedeAgregarEstudiante(): boolean {
    return !!this.selectedStudent && 
           !!this.selectedBeneficioId && 
           this.selectedPorcentaje > 0 && 
           this.selectedPorcentaje <= 100;
  }

  get selectedBeneficioNombre(): string {
    const beneficio = this.beneficioService.currentData.find(
      (b: Beneficio) => b.id === this.selectedBeneficioId
    );
    return beneficio ? beneficio.nombre : '';
  }

  async agregarNuevoEstudiante(): Promise<void> {
    if (this.isAddingStudent || !this.selectedStudent || !this.puedeAgregarEstudiante) {
      return;
    }

    this.isAddingStudent = true;
    this.loadingService.show('Agregando estudiante...');

    try {
      const idEstudiante = this.selectedStudent.id;
      const ciEstudiante = this.selectedStudent.carnet;
      const nombreEstudiante = this.selectedStudent.nombre;

      if (!window.academicoAPI) {
        throw new Error('API de Académico no disponible');
      }

      // Get beneficio info
      const beneficio = this.beneficioService.currentData.find(
        (b: Beneficio) => b.id === this.selectedBeneficioId
      );

      if (!beneficio) {
        throw new Error('Beneficio no encontrado');
      }

      // Verificar si el estudiante ya tiene un beneficio en la gestión actual
      const idGestionActual = this.semestreActual[0]?.id || '';
      const beneficioExistente = await this.verificarBeneficioExistente(ciEstudiante, idGestionActual);

      if (beneficioExistente.existe) {
        // Check if it's the SAME benefit (ERROR) or DIFFERENT benefit (WARNING)
        if (beneficioExistente.idBeneficio === this.selectedBeneficioId) {
          // Same benefit - this is an ERROR, block it
          throw new Error(
            `El estudiante ya tiene registrado el beneficio "${beneficioExistente.beneficioNombre}" (${beneficioExistente.porcentaje?.toFixed(0)}%) en la gestión actual`
          );
        } else {
          // Different benefit - show warning but allow to continue
          this.toastService.warning(
            'Beneficio Adicional',
            `Nota: El estudiante ya tiene el beneficio "${beneficioExistente.beneficioNombre}" (${beneficioExistente.porcentaje?.toFixed(0)}%) en esta gestión`,
            5000
          );
        }
      }

      // Get kardex information
      const kardex = await window.academicoAPI.obtenerKardexEstudiante(idEstudiante);
      
      if (!kardex || kardex.length === 0) {
        throw new Error('No se encontró kardex para el estudiante');
      }

      const [totalCreditos, carrera, sinKardex] = await this.academicoUtils.obtenerInformacionKardexConFlag(kardex, this.semestreActual);

      if (sinKardex || totalCreditos === 0) {
        throw new Error('No tiene créditos registrados en los semestres activos');
      }

      // Get payment information
      const [referencia, planAccedido, pagoRealizado, sinPago, pagosSemestre, pagoCreditoTecnologico] = await this.academicoUtils.obtenerPlanDePagoRealizado(
        idEstudiante,
        this.semestreActual
      );

      // Si no hay pago pero el descuento es 100%, usar valores predeterminados
      let referenciaFinal = referencia;
      let planAccedidoFinal = planAccedido;
      let pagoRealizadoFinal = pagoRealizado;

      if ((sinPago || pagoRealizado === 0) && this.selectedPorcentaje === 100) {
        // Estudiante con 100% de descuento y sin pago - asignar valores especiales
        referenciaFinal = 'No Corresponde';
        planAccedidoFinal = 'Ninguno';
        pagoRealizadoFinal = 0;
      } else if (sinPago || pagoRealizado === 0) {
        // No hay pago y no es 100% descuento - marcar como error
        throw new Error('No se encontró factura de pago del semestre actual');
      }

      // Get career info
      const carreras = this.carreraService.currentData;
      const carreraInfo = carreras.find(c =>
        c.carrera.normalize('NFD').replace(/[\u0300-\u036f]/g, '') ===
        carrera.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      );

      if (!carreraInfo) {
        throw new Error(`Carrera "${carrera}" no encontrada en el sistema`);
      }

      // Calculate discount (selectedPorcentaje is in 0-100 format, convert to decimal)
      const porcentajeDecimal = this.selectedPorcentaje / 100;
      //const montoDescuento = pagoRealizado * porcentajeDecimal;
      //const nuevoMonto = pagoRealizado - montoDescuento;

      // Calculate valor_credito and credito_tecnologico
      const valorCredito = carreraInfo.tarifario?.valor_credito || 0;
      const creditoTecnologico = carreraInfo.incluye_tecnologico ? valorCredito : 0;

      // Create new estudiante entry (store as decimal 0-1)
      const nuevoEstudiante: EstudianteBeneficio = {
        rowNumber: this.processedEstudiantes.length > 0 
          ? Math.max(...this.processedEstudiantes.map(e => e.rowNumber)) + 1 
          : 1,
        nombre: nombreEstudiante,
        carnet: ciEstudiante,
        beneficio: beneficio.nombre,
        porcentaje: porcentajeDecimal, // Store as decimal (0-1)
        hasErrors: false
      };

      // Create registro
      const registro: RegistroEstudiante = {
        id: `temp-${Date.now()}-${Math.random()}`,
        id_solicitud: '',
        id_estudiante_siaan: idEstudiante,
        ci_estudiante: ciEstudiante,
        nombre_estudiante: nombreEstudiante,
        carrera: carrera,
        id_carrera: carreraInfo.id,
        id_beneficio: beneficio.id,
        total_creditos: totalCreditos,
        valor_credito: valorCredito,
        credito_tecnologico: creditoTecnologico,
        porcentaje_descuento: porcentajeDecimal, // Already in decimal format
        monto_primer_pago: pagoRealizadoFinal,
        plan_primer_pago: planAccedidoFinal,
        referencia_primer_pago: referenciaFinal,
        pagos_realizados: pagosSemestre,
        pago_credito_tecnologico: pagoCreditoTecnologico,
        total_semestre: (totalCreditos * valorCredito) + creditoTecnologico,
        registrado: false,
        id_gestion: this.semestreActual[0]?.id || ''
      };

      nuevoEstudiante.registro = registro;

      // Add to processedEstudiantes
      this.processedEstudiantes.push(nuevoEstudiante);

      this.loadingService.hide();

      this.toastService.success(
        'Estudiante agregado',
        `${nombreEstudiante} ha sido agregado exitosamente con ${this.selectedPorcentaje}% de descuento.`,
        4000
      );

      // Close modal
      this.cerrarModalAgregarEstudiante();

    } catch (error) {
      console.error('Error agregando estudiante:', error);
      this.loadingService.hide();
      this.toastService.error(
        'Error al agregar',
        error instanceof Error ? error.message : 'No se pudo agregar el estudiante'
      );
    } finally {
      this.isAddingStudent = false;
    }
  }
}
