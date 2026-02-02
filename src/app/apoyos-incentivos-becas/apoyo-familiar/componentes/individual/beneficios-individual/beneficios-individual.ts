import { Component, inject, OnInit } from '@angular/core';
import { RouterLink, Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { LoadingService } from '../../../../../shared/servicios/loading';
import { RegistroEstudiante } from '../../../../interfaces/registro-estudiante';
import { Beneficio } from '../../../../interfaces/beneficio';
import { Gestion } from '../../../../interfaces/gestion';
import { StudentSearchResult } from '../../../../../shared/interfaces/student-search';
import { StudentAutocompleteComponent } from '../../../../../shared/componentes/student-autocomplete/student-autocomplete';
import { ManualPaymentModalComponent, ManualPaymentData } from '../../shared/manual-payment-modal/manual-payment-modal';
import '../../../../../shared/interfaces/electron-api';
import { CarreraService } from '../../../../servicios/carrera.service';
import { BeneficioService } from '../../../../servicios/beneficio.service';
import { ToastService } from '../../../../../shared/servicios/toast';
import { ToastContainerComponent } from '../../../../../shared/componentes/toast-container/toast-container';
import { GestionService } from '../../../../servicios/gestion.service';
import { RegistroIndividualDataService } from '../../../../servicios/registro-individual-data';
import { AcademicoUtilsService } from '../../../../servicios/academico-utils.service';

@Component({
  selector: 'app-beneficios-individual',
  imports: [
    RouterLink, 
    CommonModule, 
    FormsModule, 
    ToastContainerComponent, 
    StudentAutocompleteComponent, 
    ManualPaymentModalComponent
  ],
  templateUrl: './beneficios-individual.html',
  styleUrl: './beneficios-individual.scss'
})
export class BeneficiosIndividual implements OnInit {
  semestreActual: Gestion[] = [];
  estudiante: RegistroEstudiante | null = null;
  beneficioSeleccionado: string = '';
  porcentajePersonalizado: number = 0;
  mostrarInputPorcentaje: boolean = false;
  
  // Manual payment input state
  showManualPaymentModal: boolean = false;
  
  // Kardex error modal state
  showKardexErrorModalFlag: boolean = false;
  kardexErrorMessages: string[] = [];

  public loadingService = inject(LoadingService);
  private carreraService = inject(CarreraService);
  private beneficioService = inject(BeneficioService);
  private gestionService = inject(GestionService);
  private toastService = inject(ToastService);
  private dataService = inject(RegistroIndividualDataService);
  private router = inject(Router);
  private academicoUtils = inject(AcademicoUtilsService);

  async ngOnInit() {
    // Cargar gestiones activas y beneficios al inicializar el componente
    await this.gestionService.loadGestionData();
    this.semestreActual = this.gestionService.getActiveGestiones();

    if (this.semestreActual.length === 0) {
      console.warn('No se encontraron gestiones activas');
    }

    // Cargar beneficios
    await this.beneficioService.loadBeneficioData();
  }

  // Obtener lista de beneficios disponibles
  get beneficiosDisponibles(): Beneficio[] {
    return this.beneficioService.currentData;
  }

  // Check if form is ready to process
  get canProcess(): boolean {
    if (!this.estudiante || !this.beneficioSeleccionado) {
      return false;
    }
    
    // Si se debe mostrar input de porcentaje, verificar que sea válido
    if (this.mostrarInputPorcentaje) {
      return this.porcentajePersonalizado > 0 && this.porcentajePersonalizado <= 100;
    }
    
    return true;
  }

  // Handle student selection from autocomplete
  onStudentSelected(student: StudentSearchResult) {
    // Solo permitir un estudiante a la vez
    const registro: Partial<RegistroEstudiante> = {
      ci_estudiante: student.carnet,
      nombre_estudiante: student.nombre,
      id_estudiante_siaan: student.id,
    };

    this.estudiante = registro as RegistroEstudiante;
  }

  removeStudent() {
    this.estudiante = null;
    this.resetFormulario();
  }

  // Handle beneficio selection change
  onBeneficioChange() {
    const beneficio = this.beneficiosDisponibles.find(b => b.id === this.beneficioSeleccionado);
    
    if (beneficio) {
      // Si el beneficio tiene porcentaje 0 o no definido, mostrar input
      this.mostrarInputPorcentaje = !beneficio.porcentaje || beneficio.porcentaje === 0;
      
      if (!this.mostrarInputPorcentaje) {
        this.porcentajePersonalizado = beneficio.porcentaje || 0;
      } else {
        this.porcentajePersonalizado = 0;
      }
    } else {
      this.mostrarInputPorcentaje = false;
      this.porcentajePersonalizado = 0;
    }
  }

  // Get beneficio name for display
  getBeneficioNombre(id: string): string {
    const beneficio = this.beneficiosDisponibles.find(b => b.id === id);
    return beneficio?.nombre || '';
  }

  // Get selected beneficio object
  getBeneficioSeleccionado(): Beneficio | undefined {
    return this.beneficiosDisponibles.find(b => b.id === this.beneficioSeleccionado);
  }

  async onSubmit() {
    if (!this.canProcess || !this.estudiante) {
      return;
    }

    this.loadingService.show();

    try {
      // Verify API availability
      if (!window.academicoAPI?.obtenerIDPersona || !window.academicoAPI?.obtenerKardexEstudiante) {
        throw new Error('academicoAPI not available');
      }

      // Load detailed information for the student
      try {
        // Get kardex information
        const kardex = await window.academicoAPI.obtenerKardexEstudiante(this.estudiante.id_estudiante_siaan);
        const [materias, carrera] = await this.academicoUtils.obtenerInformacionKardex(kardex, this.semestreActual);
        const totalCreditos = await this.academicoUtils.calcularTotalUVE(materias);
        // Get payment information
        let [referencia, planAccedido, pagoRealizado, sinPago, pagosSemestre, pago_credito_tecnologico] = await this.academicoUtils.obtenerPlanDePagoRealizado(this.estudiante.id_estudiante_siaan, this.semestreActual);

        // Find career info in database
        const carreraInfo = this.carreraService.currentData.find(c =>
          c.carrera.normalize('NFD').replace(/[\u0300-\u036f]/g, '') ===
          carrera.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
        );

        // Get selected beneficio
        const beneficio = this.beneficiosDisponibles.find(b => b.id === this.beneficioSeleccionado);
        const porcentajeDescuento = this.mostrarInputPorcentaje ? this.porcentajePersonalizado / 100 : (beneficio?.porcentaje || 0);

        // Si no hay pago pero el descuento es 100%, usar valores predeterminados
        let referenciaFinal = referencia;
        let planAccedidoFinal = planAccedido || 'N/A';
        let pagoRealizadoFinal = pagoRealizado || 0;

        if ((sinPago || pagoRealizado === 0) && porcentajeDescuento === 1) {
          // Estudiante con 100% de descuento y sin pago - asignar valores especiales
          referenciaFinal = 'No Corresponde';
          planAccedidoFinal = 'Ninguno';
          pagoRealizadoFinal = 0;
        } else if (sinPago || pagoRealizado === 0) {
          // No hay pago y no es 100% descuento - solicitar entrada manual
          this.loadingService.hide();
          const resultManual = await this.promptForManualPaymentData(this.estudiante.id_estudiante_siaan);
          referenciaFinal = resultManual[0] || 'N/A';
          planAccedidoFinal = resultManual[1] || 'N/A';
          pagoRealizadoFinal = resultManual[2] || 0;
          if(pagosSemestre > 0){
            pagosSemestre -= pagoRealizadoFinal;
          }
        }

        // Update the registry with complete information
        this.estudiante = {
          ...this.estudiante,
          id_gestion: this.semestreActual[0]?.id, // ID de la gestión activa
          carrera: carreraInfo?.carrera || carrera || 'N/A',
          id_carrera: carreraInfo?.id,
          id_beneficio: this.beneficioSeleccionado,
          porcentaje_descuento: porcentajeDescuento,
          total_creditos: totalCreditos || 0,
          plan_primer_pago: planAccedidoFinal,
          monto_primer_pago: pagoRealizadoFinal,
          referencia_primer_pago: referenciaFinal,
          pago_credito_tecnologico: pago_credito_tecnologico,
          pagos_realizados: pagosSemestre ? pagosSemestre : undefined,
          materias: materias // Almacenar las materias para ver en el modal
        };

        // Calculate financial details
        if (carreraInfo) {
          this.estudiante.valor_credito = carreraInfo.tarifario?.valor_credito || 0;
          this.estudiante.credito_tecnologico = carreraInfo.incluye_tecnologico ? carreraInfo.tarifario?.valor_credito || 0 : 0;
          this.estudiante.creditos_descuento = beneficio?.limite_creditos ? totalCreditos > beneficio?.limite_creditos ? beneficio.limite_creditos : totalCreditos : totalCreditos;
          this.estudiante.total_semestre = this.estudiante.valor_credito * (this.estudiante.total_creditos || 0) + this.estudiante.credito_tecnologico;
        }

        // Mostrar resumen y opciones para guardar
        this.mostrarResumenYGuardar();

      } catch (error) {
        // Check if it's a kardex semester error
        if (error instanceof Error && error.message.includes('No se encontró información para el semestre')) {
          this.showKardexErrorModal([`${this.estudiante.nombre_estudiante} (${this.estudiante.ci_estudiante}): ${error.message}`]);
          return;
        }

        // Keep basic info if detailed loading fails
        this.toastService.error(
          'Error',
          'No se pudo cargar la información completa del estudiante',
          4000
        );
        throw error;
      }

    } catch (error) {
      console.error('Error processing submission:', error);
      this.toastService.error(
        'Error',
        'Ocurrió un error al procesar la solicitud',
        4000
      );
    } finally {
      this.loadingService.hide();
    }
  }

  mostrarResumenYGuardar() {
    if (!this.estudiante) return;

    const beneficioNombre = this.getBeneficioNombre(this.beneficioSeleccionado);
    

    // Guardar datos en el servicio y navegar a la vista individual
    this.dataService.setRegistrosAndNavigate([this.estudiante], 'otros-beneficios');
    
    // Navegar directamente a vista-individual
    this.router.navigate(['/vista-individual']);
  }

  resetFormulario() {
    this.estudiante = null;
    this.beneficioSeleccionado = '';
    this.porcentajePersonalizado = 0;
    this.mostrarInputPorcentaje = false;
  }

  getGestionesNames(): string {
    return this.semestreActual.map(g => g.gestion).join(', ');
  }

  private promptForManualPaymentData(id_estudiante: string): Promise<[string, string, number, boolean]> {
    return new Promise((resolve) => {
      this.showManualPaymentModal = true;
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
  }

  onManualPaymentCancel(): void {
    if (this.manualPaymentResolve) {
      this.manualPaymentResolve(['', '', 0, true]); // sinPago = true on cancel
      this.manualPaymentResolve = null;
    }

    this.showManualPaymentModal = false;
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

  // Get excluded CIs for autocomplete (only current student)
  getExcludedCIs(): string[] {
    return this.estudiante ? [this.estudiante.ci_estudiante] : [];
  }
}
