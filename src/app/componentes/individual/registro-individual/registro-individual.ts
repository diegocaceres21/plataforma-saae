import { Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { LoadingService } from '../../../servicios/loading';
import { RegistroEstudiante } from '../../../interfaces/registro-estudiante';
import { Gestion } from '../../../interfaces/gestion';
import { StudentSearchResult, StudentAutocompleteState } from '../../../interfaces/student-search';
import '../../../interfaces/electron-api'; // Importar tipos de Electron
import { Subject, of } from 'rxjs';
import { debounceTime, distinctUntilChanged, switchMap, catchError } from 'rxjs/operators';
import { ApoyoFamiliarService } from '../../../servicios/apoyo-familiar.service';
import { CarreraService } from '../../../servicios/carrera.service';
import { RegistroIndividualDataService } from '../../../servicios/registro-individual-data';
import { ToastService } from '../../../servicios/toast';
import { ToastContainerComponent } from '../../shared/toast-container/toast-container';

@Component({
  selector: 'app-registro-individual',
  imports: [RouterLink, CommonModule, FormsModule, ToastContainerComponent],
  templateUrl: './registro-individual.html',
  styleUrl: './registro-individual.scss'
})

export class RegistroIndividual {
  // Single input for search
  searchQuery: string = '';
  semestreActual: Gestion = { id: '581e078e-2c19-4d8f-a9f8-eb5ac388cb44', gestion: '2-2025', anio: 2024, tipo: 'Semestre', activo: true, visible: true };
  registrosEstudiantes: RegistroEstudiante[] = [];
  successMessage: string = '';
  
  // Manual payment input state
  showManualPaymentModal: boolean = false;
  currentStudentForManualInput: string = '';
  manualPaymentData = {
    referencia: '',
    planAccedido: '',
    pagoRealizado: 0
  };
  
  // Kardex error modal state
  showKardexErrorModalFlag: boolean = false;
  kardexErrorMessages: string[] = [];
  
  // Career selection modal state
  showCareerSelectionModal: boolean = false;
  currentStudentWithCareerIssue: any = null;
  availableCareers: any[] = [];
  selectedCareerForStudent: string = '';
  originalCareerFromKardex: string = '';
  
  // Single autocomplete state
  autocompleteState: StudentAutocompleteState = {
    query: '', results: [], isLoading: false, isOpen: false, selectedIndex: -1
  };
  
  // Single search subject for debouncing
  private searchSubject = new Subject<string>();
  
  public loadingService = inject(LoadingService);
  private apoyoFamiliarService = inject(ApoyoFamiliarService);
  private carreraService = inject(CarreraService);
  private dataService = inject(RegistroIndividualDataService);
  private toastService = inject(ToastService);
  
  constructor() {
    this.initializeSearchSubject();
  }
  
  private initializeSearchSubject() {
    // Initialize single search subject for debounced API calls
    this.searchSubject.pipe(
      debounceTime(300), // Wait 300ms after user stops typing
      distinctUntilChanged(),
      switchMap((query) => 
        of(query).pipe(
          switchMap(async (searchQuery) => {
            await this.searchStudents(searchQuery);
            return searchQuery;
          }),
          catchError(error => {
            console.error('Search error:', error);
            this.autocompleteState.isLoading = false;
            this.autocompleteState.results = [];
            return of(query);
          })
        )
      )
    ).subscribe();
  }
  
  onInputChange(query: string) {
    this.searchQuery = query;
    this.autocompleteState.query = query;
    
    if (query.trim().length >= 2) {
      this.autocompleteState.isLoading = true;
      this.autocompleteState.isOpen = true;
      this.searchSubject.next(query.trim());
    } else {
      this.autocompleteState.isOpen = false;
      this.autocompleteState.results = [];
      this.autocompleteState.isLoading = false;
    }
  }
  
  // Check if procesar button should be enabled (at least 2 students)
  get canProcess(): boolean {
    return this.registrosEstudiantes.length >= 2;
  }
  
  private async searchStudents(query: string): Promise<void> {
    try {
      if (!window.academicoAPI?.obtenerPersonasPorCarnet) {
        throw new Error('academicoAPI not available');
      }
      
      // Use the new API that returns multiple results - ONLY basic info for autocomplete
      const searchResults: StudentSearchResult[] = [];
      
      try {
        const personas = await window.academicoAPI.obtenerPersonasPorCarnet(query);
        
        // Only process basic information for fast autocomplete
        // Filter out students that are already in the list
        for (const persona of personas) {
          const carnet = persona.documentoIdentidad || persona.carnet || query;
          const isAlreadyAdded = this.registrosEstudiantes.some(r => r.ci_estudiante === carnet);
          
          if (!isAlreadyAdded) {
            searchResults.push({
              id: persona.id,
              carnet: carnet,
              nombre: persona.nombreCompleto || persona.nombre || 'Nombre no disponible',
              carrera: 'Información se cargará al procesar', // Placeholder text
              creditos: 0 // Will be loaded when processing
            });
          }
        }
      } catch (error) {
        console.log(`No se encontraron estudiantes con el criterio: ${query}`);
      }
      
      this.autocompleteState.results = searchResults;
      this.autocompleteState.isLoading = false;
      
    } catch (error) {
      console.error('Error searching students:', error);
      this.autocompleteState.results = [];
      this.autocompleteState.isLoading = false;
    }
  }
  
  selectStudent(student: StudentSearchResult) {
    // Clear the input and close autocomplete
    this.searchQuery = '';
    this.autocompleteState.query = '';
    this.autocompleteState.isOpen = false;
    this.autocompleteState.selectedIndex = -1;
    this.autocompleteState.results = [];
    
    // Store basic student info - detailed info will be loaded when processing
    this.addBasicStudentToResults(student);
  }
  
  private addBasicStudentToResults(student: StudentSearchResult) {
    // Check if student already exists in results
    const existingIndex = this.registrosEstudiantes.findIndex(r => r.ci_estudiante === student.carnet);
    
    const registro: Partial<RegistroEstudiante> = {
      ci_estudiante: student.carnet,
      nombre_estudiante: student.nombre,
      id_estudiante_siaan: student.id,
      /*carrera: 'Pendiente de cargar...',
      total_creditos: 0,
      plan_primer_pago: 'Pendiente de cargar...',
      monto_primer_pago: 0,
      referencia_primer_pago: 'Pendiente de cargar...',*/
    };
    
    if (existingIndex !== -1) {
      this.registrosEstudiantes[existingIndex] = registro as RegistroEstudiante;
      //this.showSuccessMessage(`${student.nombre} seleccionado - información se cargará al procesar`);
    } else {
      this.registrosEstudiantes.push(registro as RegistroEstudiante);
      //this.showSuccessMessage(`${student.nombre} agregado - información se cargará al procesar`);
    }
  }
  
  private showSuccessMessage(message: string) {
    this.successMessage = message;
    setTimeout(() => {
      this.successMessage = '';
    }, 3000);
  }
  
  onInputKeyDown(event: KeyboardEvent) {
    const state = this.autocompleteState;
    
    if (!state.isOpen || state.results.length === 0) return;
    
    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        state.selectedIndex = Math.min(state.selectedIndex + 1, state.results.length - 1);
        break;
      case 'ArrowUp':
        event.preventDefault();
        state.selectedIndex = Math.max(state.selectedIndex - 1, -1);
        break;
      case 'Enter':
        event.preventDefault();
        if (state.selectedIndex >= 0) {
          this.selectStudent(state.results[state.selectedIndex]);
        }
        break;
      case 'Escape':
        state.isOpen = false;
        state.selectedIndex = -1;
        break;
    }
  }
  
  closeAutocomplete() {
    // Delay closing to allow click events on dropdown items
    setTimeout(() => {
      this.autocompleteState.isOpen = false;
      this.autocompleteState.selectedIndex = -1;
    }, 150);
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
          const [totalCreditos, carrera] = await this.obtenerInformacionKardex(kardex, this.semestreActual.gestion);
          
          // Get payment information
          const [referencia, planAccedido, pagoRealizado] = await this.obtenerPlanDePagoRealizado(registro.id_estudiante_siaan);
          
          // Update the registry with complete information
          this.registrosEstudiantes[i] = {
            ...registro,
            carrera: carrera || 'N/A',
            total_creditos: totalCreditos || 0,
            plan_primer_pago: planAccedido || 'N/A',
            monto_primer_pago: pagoRealizado || 0,
            referencia_primer_pago: referencia || 'N/A',
          };
          
        } catch (error) {
          
          // Check if it's a kardex semester error
          if (error instanceof Error && error.message.includes('No se encontró información para el semestre')) {
            hasKardexErrors = true;
            kardexErrorMessages.push(`${registro.nombre_estudiante} (${registro.ci_estudiante}): ${error.message}`);
          }
          
          // Keep basic info if detailed loading fails
          this.registrosEstudiantes[i] = {
            ...registro,
            carrera: 'Error al cargar información',
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
        const carreraInfo = carreras.find(c => 
          c.carrera.normalize('NFD').replace(/[\u0300-\u036f]/g, '') === 
          (registro.carrera || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '')
        );
        
        if (!carreraInfo && registro.carrera && registro.carrera !== 'Error al cargar información') {
          hasCareersToResolve = true;
          try {
            await this.promptForCareerSelection(registro, carreras);
            break; // Process one at a time
          } catch (error) {
            // User cancelled the career selection - stop processing completely
            console.log('🚫 Proceso cancelado por el usuario en selección de carrera');
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
    
    // Apply career information to all students
    this.registrosEstudiantes.forEach(registro => {
      const carreraInfo = carreras.find(c => 
        c.carrera.normalize('NFD').replace(/[\u0300-\u036f]/g, '') === 
        (registro.carrera || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      );
      if (carreraInfo) {
        registro.valor_credito = carreraInfo.tarifario?.valor_credito || 0;
        registro.credito_tecnologico = carreraInfo.incluye_tecnologico ? carreraInfo.tarifario?.valor_credito || 0 : 0;
        registro.total_semestre = registro.valor_credito * (registro.total_creditos || 0) + registro.credito_tecnologico;
      }
    });
    
    console.log('Final student records with complete information:', this.registrosEstudiantes);
    this.showSuccessMessage('Información completa cargada para todos los estudiantes');
    
    // Pasar datos al servicio compartido y navegar a la vista
    console.log('📊 Pasando datos al servicio y navegando a vista-individual');
    this.dataService.setRegistrosAndNavigate(this.registrosEstudiantes);
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

  async obtenerInformacionKardex(kardex: any[], semestre_actual: string): Promise<[number, string]> {
    let totalCreditos: number = 0;
    let carrera: string = '';
    let semestreEncontrado = false;

    // Iterate over kardex in reverse
    for (let i = kardex.length - 1; i >= 0; i--) {
      const semestre = kardex[i];

      if (semestre.encabezado[0].includes(semestre_actual)) {
        totalCreditos = parseInt(
          semestre.tabla.datos[semestre.tabla.datos.length - 1][6].contenidoCelda[0].contenido,
          10
        );
        // Remueve acentos de la carrera
        carrera = semestre.encabezado[semestre.encabezado.length - 1]
          .split(': ')
          .pop()
          ?.normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '') || '';
        semestreEncontrado = true;
        break;
      }
    }

    // Si no se encontró el semestre, lanzar error
    if (!semestreEncontrado) {
      throw new Error(`No se encontró información para el semestre "${semestre_actual}" en el kardex del estudiante.`);
    }

    return [totalCreditos, carrera];
  }

  async obtenerPlanDePagoRealizado(id_estudiante: string): Promise<[string, string, number]> {
    let referencia = "";
    let planAccedido = "";
    let pagoRealizado = 0;
    
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
                
                if (referencia.includes(this.semestreActual.gestion)) {
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
      console.error('Error in obtenerPlanDePagoRealizado:', error);
    }
    
    // If no payment data was found automatically, prompt for manual input
    if (!planAccedido || !referencia || pagoRealizado === 0) {
      return await this.promptForManualPaymentData(id_estudiante);
    }
    
    return [referencia, planAccedido, pagoRealizado];
  }

  private promptForManualPaymentData(id_estudiante: string): Promise<[string, string, number]> {
    return new Promise((resolve) => {
      // Find student name for display
      const student = this.registrosEstudiantes.find(r => r.id_estudiante_siaan === id_estudiante);
      const studentName = student?.nombre_estudiante || id_estudiante;
      
      // Reset manual input data
      this.manualPaymentData = {
        referencia: '',
        planAccedido: 'PLAN ESTANDAR', // Default value
        pagoRealizado: 0
      };
      
      this.currentStudentForManualInput = studentName;
      this.showManualPaymentModal = true;
      
      // Store the resolve function to be called when modal is submitted
      this.manualPaymentResolve = resolve;
    });
  }
  
  private manualPaymentResolve: ((value: [string, string, number]) => void) | null = null;
  
  onManualPaymentSubmit(): void {
    if (this.manualPaymentResolve) {
      const result: [string, string, number] = [
        this.manualPaymentData.referencia,
        this.manualPaymentData.planAccedido,
        this.manualPaymentData.pagoRealizado
      ];
      
      this.manualPaymentResolve(result);
      this.manualPaymentResolve = null;
    }
    
    this.showManualPaymentModal = false;
    this.currentStudentForManualInput = '';
  }
  
  onManualPaymentCancel(): void {
    if (this.manualPaymentResolve) {
      // Return default/empty values if cancelled
      this.manualPaymentResolve(['', '', 0]);
      this.manualPaymentResolve = null;
    }
    
    this.showManualPaymentModal = false;
    this.currentStudentForManualInput = '';
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
      // Update the student's career with the selected one
      this.currentStudentWithCareerIssue.carrera = this.selectedCareerForStudent;
      
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
    console.log('🚫 Usuario canceló la selección de carrera, proceso detenido');
  }

  async continueCareerResolution(): Promise<void> {
    const carreras = this.carreraService.currentData;
    
    // Check if there are more career issues to resolve
    for (const registro of this.registrosEstudiantes) {
      const carreraInfo = carreras.find(c => 
        c.carrera.normalize('NFD').replace(/[\u0300-\u036f]/g, '') === 
        (registro.carrera || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      );
      
      if (!carreraInfo && registro.carrera && registro.carrera !== 'Error al cargar información') {
        // Found another career issue, prompt for selection
        try {
          await this.promptForCareerSelection(registro, carreras);
          return; // Process one at a time
        } catch (error) {
          // User cancelled the career selection - stop processing completely
          console.log('🚫 Proceso cancelado por el usuario en continueCareerResolution');
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
