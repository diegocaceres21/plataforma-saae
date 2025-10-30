import { Component, inject, OnInit } from '@angular/core';
import { RouterLink, Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { LoadingService } from '../../../../../shared/servicios/loading';
import { RegistroEstudiante } from '../../../../interfaces/registro-estudiante';
import { Gestion } from '../../../../interfaces/gestion';
import { StudentSearchResult } from '../../../../../shared/interfaces/student-search';
import { StudentAutocompleteComponent } from '../../../../../shared/componentes/student-autocomplete/student-autocomplete';
import { ManualPaymentModalComponent, ManualPaymentData } from '../../shared/manual-payment-modal/manual-payment-modal';
import '../../../../../shared/interfaces/electron-api'; // Importar tipos de Electron
import { ApoyoFamiliarService } from '../../../../servicios/apoyo-familiar.service';
import { CarreraService } from '../../../../servicios/carrera.service';
import { BeneficioService } from '../../../../servicios/beneficio.service';
import { RegistroIndividualDataService } from '../../../../servicios/registro-individual-data';
import { ToastService } from '../../../../../shared/servicios/toast';
import { ToastContainerComponent } from '../../../../../shared/componentes/toast-container/toast-container';
import { GestionService } from '../../../../servicios/gestion.service';

@Component({
  selector: 'app-registro-individual',
  imports: [RouterLink, CommonModule, FormsModule, ToastContainerComponent, StudentAutocompleteComponent, ManualPaymentModalComponent],
  templateUrl: './registro-individual.html',
  styleUrl: './registro-individual.scss'
})

export class RegistroIndividual implements OnInit {
  semestreActual: Gestion[] = [];
  registrosEstudiantes: RegistroEstudiante[] = [];
  successMessage: string = '';
  gestionService = inject(GestionService)

  // Manual payment input state
  showManualPaymentModal: boolean = false;
  currentStudentForManualInput: string = '';
  currentStudentCIForManualInput: string = '';

  // Kardex error modal state
  showKardexErrorModalFlag: boolean = false;
  kardexErrorMessages: string[] = [];

  // Career selection modal state
  showCareerSelectionModal: boolean = false;
  currentStudentWithCareerIssue: any = null;
  availableCareers: any[] = [];
  selectedCareerForStudent: string = '';
  originalCareerFromKardex: string = '';

  public loadingService = inject(LoadingService);
  private apoyoFamiliarService = inject(ApoyoFamiliarService);
  private carreraService = inject(CarreraService);
  private beneficioService = inject(BeneficioService);
  private dataService = inject(RegistroIndividualDataService);
  private toastService = inject(ToastService);
  private router = inject(Router);

  async ngOnInit() {
    // Cargar gestiones activas y beneficios al inicializar el componente
    await this.gestionService.loadGestionData();
    this.semestreActual = this.gestionService.getActiveGestiones();

    if (this.semestreActual.length === 0) {
      console.warn('No se encontraron gestiones activas');
    }

    // Cargar beneficios para obtener ID de "APOYO FAMILIAR"
    await this.beneficioService.loadBeneficioData();
  }

  // Check if procesar button should be enabled (at least 2 students)
  get canProcess(): boolean {
    return this.registrosEstudiantes.length >= 2;
  }

  // Get CIs of already added students for autocomplete exclusion
  getExcludedCIs(): string[] {
    return this.registrosEstudiantes.map(r => r.ci_estudiante);
  }

  // Handle student selection from autocomplete
  onStudentSelected(student: StudentSearchResult) {
    // Check if student already exists in results
    const existingIndex = this.registrosEstudiantes.findIndex(r => r.ci_estudiante === student.carnet);

    const registro: Partial<RegistroEstudiante> = {
      ci_estudiante: student.carnet,
      nombre_estudiante: student.nombre,
      id_estudiante_siaan: student.id,
    };

    if (existingIndex === -1) {
      this.registrosEstudiantes.push(registro as RegistroEstudiante);
    }
  }

  removeStudentFromResults(carnet: string) {
    this.registrosEstudiantes = this.registrosEstudiantes.filter(r => r.ci_estudiante !== carnet);
  }

  async onSubmit() {
    if (!this.canProcess) {
      return;
    }

    this.loadingService.show();

    try {
      // Verify API availability
      if (!window.academicoAPI?.obtenerIDPersona || !window.academicoAPI?.obtenerKardexEstudiante) {
        throw new Error('academicoAPI not available');
      }

      let hasKardexErrors = false;
      let kardexErrorMessages: string[] = [];

      // Now load detailed information for each selected student
      for (let i = 0; i < this.registrosEstudiantes.length; i++) {
        const registro = this.registrosEstudiantes[i];
        try {
          // Get kardex information
          const kardex = await window.academicoAPI.obtenerKardexEstudiante(registro.id_estudiante_siaan);
          const [totalCreditos, carrera] = await this.obtenerInformacionKardex(kardex, this.semestreActual);

          // Get payment information
          const [referencia, planAccedido, pagoRealizado, sinPago, pagosSemestre, pagoCreditoTecnologico] = await this.obtenerPlanDePagoRealizado(registro.id_estudiante_siaan);

          // Find career info in database
          const carreraInfo = this.carreraService.currentData.find(c =>
            c.carrera.normalize('NFD').replace(/[\u0300-\u036f]/g, '') ===
            carrera.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
          );

          // Get ID de beneficio "APOYO FAMILIAR"
          const idBeneficio = this.beneficioService.getApoyoFamiliarId();

          // Determinar valores finales de pago
          let referenciaFinal = referencia;
          let planAccedidoFinal = planAccedido || 'N/A';
          let pagoRealizadoFinal = pagoRealizado || 0;

          // Si no hay pago, solicitar entrada manual (el usuario decide si continuar o no)
          if (sinPago) {
            const resultManual = await this.promptForManualPaymentData(registro.id_estudiante_siaan);
            referenciaFinal = resultManual[0] || 'N/A';
            planAccedidoFinal = resultManual[1] || 'N/A';
            pagoRealizadoFinal = resultManual[2] || 0;
            
            // Si el usuario cancela y resultManual[3] = true (sinPago sigue true)
            // los valores quedan como N/A, 0, etc.
          }

          // Update the registry with complete information
          this.registrosEstudiantes[i] = {
            ...registro,
            id_gestion: this.semestreActual[0]?.id, // ID de la gestión activa
            carrera: carreraInfo?.carrera || carrera || 'N/A', // Solo para mostrar en UI
            id_carrera: carreraInfo?.id, // Campo principal que se guardará en BD
            id_beneficio: idBeneficio, // ID del beneficio "APOYO FAMILIAR"
            total_creditos: totalCreditos || 0,
            creditos_descuento: totalCreditos || 0,
            plan_primer_pago: planAccedidoFinal,
            monto_primer_pago: pagoRealizadoFinal,
            referencia_primer_pago: referenciaFinal,
            pagos_realizados: pagosSemestre ? pagosSemestre : undefined,
            pago_credito_tecnologico: pagoCreditoTecnologico
          };

        } catch (error) {

          // Check if it's a kardex semester error
          if (error instanceof Error && error.message.includes('No se encontró información para el semestre')) {
            hasKardexErrors = true;
            kardexErrorMessages.push(`${registro.nombre_estudiante} (${registro.ci_estudiante}): ${error.message}`);
          }

          // Get ID de beneficio "APOYO FAMILIAR"
          const idBeneficio = this.beneficioService.getApoyoFamiliarId();

          // Keep basic info if detailed loading fails
          this.registrosEstudiantes[i] = {
            ...registro,
            id_gestion: this.semestreActual[0]?.id, // ID de la gestión activa
            carrera: 'Error al cargar información', // Solo para mostrar en UI
            id_carrera: undefined,
            id_beneficio: idBeneficio, // ID del beneficio "APOYO FAMILIAR"
            total_creditos: 0,
            plan_primer_pago: 'Error al cargar información',
            monto_primer_pago: 0,
            referencia_primer_pago: 'Error al cargar información',
          };
        }
      }

      // If there are kardex errors, show toast and modal and stop processing
      if (hasKardexErrors) {
        this.showKardexErrorModal(kardexErrorMessages);
        return; // Stop processing and don't navigate to view
      }
      this.calcularPorcentajes();
      const carreras = this.carreraService.currentData;

      // Check for career mismatches before proceeding
      let hasCareersToResolve = false;
      for (const registro of this.registrosEstudiantes) {
        // Verificar si no tiene id_carrera pero sí tiene texto de carrera (y no es error)
        if (!registro.id_carrera && registro.carrera && registro.carrera !== 'Error al cargar información' && registro.carrera !== 'N/A') {
          hasCareersToResolve = true;
          try {
            await this.promptForCareerSelection(registro, carreras);
            break; // Process one at a time
          } catch (error) {
            // User cancelled the career selection - stop processing completely
            return;
          }
        }
      }

      // If we need to resolve careers, stop here and wait for user input
      if (hasCareersToResolve) {
        return;
      }

      // Continue with final processing
      this.completeFinalProcessing();

    } catch (error) {
      console.error('Error processing final submission:', error);
    } finally {
      this.loadingService.hide();
    }
  }

  completeFinalProcessing(): void {
    const carreras = this.carreraService.currentData;

    // Apply career information to all students using id_carrera
    this.registrosEstudiantes.forEach(registro => {
      if (registro.id_carrera) {
        // Buscar por ID de carrera (nuevo método principal)
        const carreraInfo = carreras.find(c => c.id === registro.id_carrera);

        if (carreraInfo) {
          registro.valor_credito = carreraInfo.tarifario?.valor_credito || 0;
          registro.credito_tecnologico = carreraInfo.incluye_tecnologico ? carreraInfo.tarifario?.valor_credito || 0 : 0;
          registro.total_semestre = registro.valor_credito * (registro.total_creditos || 0) + registro.credito_tecnologico;
        }
      }
    });

    // Pasar datos al servicio compartido y navegar a la vista
    this.dataService.setRegistrosAndNavigate(this.registrosEstudiantes, 'apoyo-familiar');
    
    // Navegar a vista-individual
    this.router.navigate(['/vista-individual']);
  }

  calcularPorcentajes() {
    this.registrosEstudiantes.sort((a, b) => (b.total_creditos || 0) - (a.total_creditos || 0));

    const apoyoFamiliarData = this.apoyoFamiliarService.currentData
      .sort((a, b) => a.orden - b.orden);

    this.registrosEstudiantes.forEach((registro, index) => {
      const apoyo = apoyoFamiliarData[index] || null;
      registro.porcentaje_descuento = apoyo ? apoyo.porcentaje : 0;
    });
  }

  async obtenerInformacionKardex(kardex: any[], gestiones_activas: Gestion[]): Promise<[number, string]> {
    let totalCreditos: number = 0;
    let carrera: string = '';
    let semestresEncontrados = 0;

    // Crear array de nombres de gestiones para buscar
    const nombresGestiones = gestiones_activas.map(g => g.gestion);

    // Iterate over kardex in reverse
    for (let i = kardex.length - 1; i >= 0; i--) {
      const semestre = kardex[i];
      const encabezadoSemestre = semestre.encabezado[0];

      // Verificar si este semestre corresponde a alguna de las gestiones activas
      const gestionEncontrada = nombresGestiones.find(nombre => encabezadoSemestre.includes(nombre));

      if (gestionEncontrada) {
        const creditosSemestre = parseInt(
          semestre.tabla.datos[semestre.tabla.datos.length - 1][6].contenidoCelda[0].contenido,
          10
        );

        // Acumular créditos
        totalCreditos += creditosSemestre;

        // Obtener carrera (solo la primera vez)
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

    // Si no se encontró ningún semestre, lanzar error
    if (semestresEncontrados === 0) {
      const gestionsStr = nombresGestiones.join(', ');
      throw new Error(`No se encontró información para las gestiones "${gestionsStr}" en el kardex del estudiante.`);
    }

    // Log para debugging

    return [totalCreditos, carrera];
  }

  // Método helper para mostrar nombres de gestiones en el template
  getGestionesNames(): string {
    return this.semestreActual.map(g => g.gestion).join(', ');
  }

  async obtenerPlanDePagoRealizado(id_estudiante: string): Promise<[string, string, number, boolean, number, boolean]> {
    let referencia = "";
    let planAccedido = "";
    let pagoRealizado = 0;
    let pagosSemestre = 0;
    let pagoCreditoTecnologico = false;  
    let sinPago = false;

    try {
      if (!window.academicoAPI?.obtenerPagosRealizados) {
        throw new Error('obtenerPagosRealizados API not available');
      }

      const pagos = await window.academicoAPI.obtenerPagosRealizados(id_estudiante);

      for (const pago of pagos) {
        if (pago[4]?.contenidoCelda?.[0]?.contenido === "FACTURA REGULAR") {
          const parametros = pago[pago.length - 1]?.contenidoCelda?.[0]?.parametros;
          if (parametros && parametros.length >= 3) {
            const numeroMaestro = parametros[0]?.valorParametro;
            const idRegional = parametros[1]?.valorParametro;
            const orden = parametros[2]?.valorParametro;

            if (numeroMaestro && idRegional && orden && window.academicoAPI?.obtenerDetalleFactura) {
              const detalleFactura = await window.academicoAPI.obtenerDetalleFactura(
                numeroMaestro,
                idRegional,
                orden
              );

              for (const factura of detalleFactura) {
                referencia = factura[1]?.contenidoCelda?.[0]?.contenido || "";

                // Verificar si la referencia incluye alguna de las gestiones activas
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
                  else if(!referencia.includes("TECNOLOGICO")){
                    pagosSemestre += parseFloat(
                      (factura[factura.length - 1]?.contenidoCelda?.[0]?.contenido || "0")
                        .replace(",", "")
                    );
                  }
                  else{
                    pagoCreditoTecnologico = true;
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
      console.error('Error in obtenerPlanDePagoRealizado:', error);
    }

    // If no payment data was found automatically, mark as sin pago
    if (!planAccedido || !referencia || pagoRealizado === 0) {
      sinPago = true;
    }

    return [referencia, planAccedido, pagoRealizado, sinPago, pagosSemestre, pagoCreditoTecnologico];
  }

  private promptForManualPaymentData(id_estudiante: string): Promise<[string, string, number, boolean]> {
    return new Promise((resolve) => {
      // Find student name and CI for display
      const student = this.registrosEstudiantes.find(r => r.id_estudiante_siaan === id_estudiante);
      const studentName = student?.nombre_estudiante || '';
      const studentCI = student?.ci_estudiante || '';

      this.currentStudentForManualInput = studentName;
      this.currentStudentCIForManualInput = studentCI;
      this.showManualPaymentModal = true;

      // Store the resolve function to be called when modal is submitted
      this.manualPaymentResolve = resolve;
    });
  }

  private manualPaymentResolve: ((value: [string, string, number, boolean]) => void) | null = null;

  onManualPaymentSubmit(data: ManualPaymentData): void {
    if (this.manualPaymentResolve) {
      const result: [string, string, number, boolean] = [
        data.referencia,
        data.planAccedido,
        data.pagoRealizado,
        false // Manual input means sinPago = false
      ];

      this.manualPaymentResolve(result);
      this.manualPaymentResolve = null;
    }

    this.showManualPaymentModal = false;
    this.currentStudentForManualInput = '';
    this.currentStudentCIForManualInput = '';
  }

  onManualPaymentCancel(): void {
    if (this.manualPaymentResolve) {
      // Return default/empty values if cancelled - mark as sinPago = true
      this.manualPaymentResolve(['', '', 0, true]);
      this.manualPaymentResolve = null;
    }

    this.showManualPaymentModal = false;
    this.currentStudentForManualInput = '';
    this.currentStudentCIForManualInput = '';
  }

  // Kardex error modal methods
  showKardexErrorModal(errorMessages: string[]): void {
    this.kardexErrorMessages = errorMessages;
    this.showKardexErrorModalFlag = true;
  }

  closeKardexErrorModal(): void {
    this.showKardexErrorModalFlag = false;
    this.kardexErrorMessages = [];
  }

  // Career selection modal methods
  async promptForCareerSelection(registro: any, availableCareers: any[]): Promise<void> {
    return new Promise((resolve, reject) => {
      this.currentStudentWithCareerIssue = registro;
      this.availableCareers = availableCareers;
      this.originalCareerFromKardex = registro.carrera || '';
      this.selectedCareerForStudent = '';
      this.showCareerSelectionModal = true;

      // Store both resolve and reject functions
      (this as any).careerSelectionResolve = resolve;
      (this as any).careerSelectionReject = reject;

    });
  }

  onCareerSelectionConfirm(): void {
    if (this.selectedCareerForStudent && this.currentStudentWithCareerIssue) {
      // Find selected career info
      const selectedCareer = this.availableCareers.find(c => c.carrera === this.selectedCareerForStudent);

      if (selectedCareer) {
        // Update the student's career with ID only (carrera field is just for display)
        this.currentStudentWithCareerIssue.carrera = selectedCareer.carrera; // Solo para mostrar en UI
        this.currentStudentWithCareerIssue.id_carrera = selectedCareer.id; // Campo principal para BD
      }

      this.toastService.success(
        'Carrera Actualizada',
        `Se asignó la carrera "${this.selectedCareerForStudent}" al estudiante ${this.currentStudentWithCareerIssue.nombre_estudiante}`,
        3000
      );

      // Resolve the promise to continue processing
      if ((this as any).careerSelectionResolve) {
        (this as any).careerSelectionResolve();
        (this as any).careerSelectionResolve = null;
      }

      // Clean up reject function too
      if ((this as any).careerSelectionReject) {
        (this as any).careerSelectionReject = null;
      }

      // Check if there are more career issues to resolve
      this.closeCareerSelectionModal();
      this.continueCareerResolution();
    }
  }

  onCareerSelectionCancel(): void {
    this.toastService.warning(
      'Proceso Cancelado',
      'Se canceló la selección de carrera. El proceso no continuará hacia la vista de resultados.',
      4000
    );

    // Reset all modal states
    this.closeCareerSelectionModal();

    // Reset processing flags
    this.currentStudentWithCareerIssue = null;
    this.selectedCareerForStudent = '';
    this.originalCareerFromKardex = '';

    // Reject the promise to stop processing
    if ((this as any).careerSelectionReject) {
      (this as any).careerSelectionReject(new Error('Career selection cancelled by user'));
      (this as any).careerSelectionReject = null;
    }

    // Clean up resolve function too
    if ((this as any).careerSelectionResolve) {
      (this as any).careerSelectionResolve = null;
    }

    // Don't continue processing - user cancelled
  }

  async continueCareerResolution(): Promise<void> {
    const carreras = this.carreraService.currentData;

    // Check if there are more career issues to resolve
    for (const registro of this.registrosEstudiantes) {
      // Verificar si no tiene id_carrera pero sí tiene texto de carrera (y no es error)
      if (!registro.id_carrera && registro.carrera && registro.carrera !== 'Error al cargar información' && registro.carrera !== 'N/A') {
        // Found another career issue, prompt for selection
        try {
          await this.promptForCareerSelection(registro, carreras);
          return; // Process one at a time
        } catch (error) {
          // User cancelled the career selection - stop processing completely
          return;
        }
      }
    }

    // No more career issues, continue with final processing
    this.completeFinalProcessing();
  }

  closeCareerSelectionModal(): void {
    this.showCareerSelectionModal = false;
    this.currentStudentWithCareerIssue = null;
    this.availableCareers = [];
    this.selectedCareerForStudent = '';
    this.originalCareerFromKardex = '';
  }
}
