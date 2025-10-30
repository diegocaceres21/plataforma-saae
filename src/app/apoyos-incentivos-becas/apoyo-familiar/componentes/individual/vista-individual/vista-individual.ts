import { Component, OnInit, OnDestroy, inject } from '@angular/core';
import { Router } from '@angular/router';
import { RegistroEstudiante } from '../../../../interfaces/registro-estudiante';
import { Solicitud } from '../../../../interfaces/solicitud';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { ToastService } from '../../../../../shared/servicios/toast';
import { ToastContainerComponent } from '../../../../../shared/componentes/toast-container/toast-container';
import { Subject, takeUntil } from 'rxjs';
import { RegistroIndividualDataService, FlowType } from '../../../../servicios/registro-individual-data';
import { ApoyoFamiliarService } from '../../../../servicios/apoyo-familiar.service';
import { StudentAccordionComponent } from '../../shared/student-accordion/student-accordion';
import { ExportActionsComponent } from '../../shared/export-actions/export-actions';
import { BeneficioService } from '../../../../servicios/beneficio.service';
import '../../../../../shared/interfaces/electron-api'; // Importar tipos de Electron

@Component({
  selector: 'app-vista-individual',
  imports: [CommonModule, RouterModule, ToastContainerComponent, StudentAccordionComponent, ExportActionsComponent],
  templateUrl: './vista-individual.html',
  styleUrl: './vista-individual.scss'
})
export class VistaIndividual implements OnInit, OnDestroy {

  registrosEstudiantes: Partial<RegistroEstudiante>[] = [];
  hasValidData = false;
  flowType: FlowType = 'apoyo-familiar';
  private destroy$ = new Subject<void>();

  // Modal para resolver empates
  showTieResolutionModal = false;
  tiedGroups: { uve: number; students: Partial<RegistroEstudiante>[] }[] = [];
  currentTieGroupIndex = 0;
  currentTieStudents: Partial<RegistroEstudiante>[] = [];
  manualOrderApplied = false;

  // Drag and Drop state
  draggedIndex: number | null = null;
  dragOverIndex: number | null = null;

  ngOnInit() {
    // Cargar beneficios para tener acceso a los nombres
    this.beneficioService.loadBeneficioData();

    // Suscribirse a los datos del servicio
    this.dataService.registrosEstudiantes$
      .pipe(takeUntil(this.destroy$))
      .subscribe(registros => {
        this.registrosEstudiantes = registros;
        // Detectar empates automáticamente cuando se cargan los datos - SOLO PARA APOYO FAMILIAR
        if (registros.length > 0 && this.flowType === 'apoyo-familiar') {
          this.detectAndHandleTies();
        }
      });

    // Suscribirse al estado de validación de datos
    this.dataService.hasValidData$
      .pipe(takeUntil(this.destroy$))
      .subscribe(hasData => {
        this.hasValidData = hasData;
      });

    // Suscribirse al tipo de flujo
    this.dataService.flowType$
      .pipe(takeUntil(this.destroy$))
      .subscribe(flowType => {
        this.flowType = flowType;
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  // Método para regresar a la vista de registro
  volverARegistro(): void {
    // Limpiar datos del servicio
    this.dataService.clearData();
    
    // Navegar según el tipo de flujo
    if (this.isApoyoFamiliar()) {
      this.router.navigate(['/registro-individual']);
    } else {
      this.router.navigate(['/beneficios-individual']);
    }
  }

  // Método para detectar y manejar empates en UVE
  detectAndHandleTies(): void {
    // Agrupar estudiantes por cantidad de UVE
    const uveGroups: { [key: number]: Partial<RegistroEstudiante>[] } = {};

    this.registrosEstudiantes.forEach(estudiante => {
      const uve = estudiante.total_creditos || 0;
      if (!uveGroups[uve]) {
        uveGroups[uve] = [];
      }
      uveGroups[uve].push(estudiante);
    });

    // Identificar grupos con empates (más de un estudiante con la misma UVE)
    this.tiedGroups = [];
    Object.keys(uveGroups).forEach(uveKey => {
      const uve = parseInt(uveKey);
      const students = uveGroups[uve];
      if (students.length > 1) {
        this.tiedGroups.push({ uve, students });
      }
    });

    // Si hay empates, mostrar el modal
    if (this.tiedGroups.length > 0) {
      this.showTieResolutionModal = true;
      this.currentTieGroupIndex = 0;
      this.currentTieStudents = [...this.tiedGroups[0].students];

      this.toastService.info(
        'Empates Detectados',
        `Se encontraron ${this.tiedGroups.length} grupo(s) de estudiantes con empates en UVE. Por favor, reordene para determinar los descuentos.`,
        6000
      );
    }
  }

  // Método para mover un estudiante hacia arriba en el orden de empate
  moveStudentUp(index: number): void {
    if (index > 0 && this.currentTieStudents.length > 1) {
      const temp = this.currentTieStudents[index];
      this.currentTieStudents[index] = this.currentTieStudents[index - 1];
      this.currentTieStudents[index - 1] = temp;
    }
  }

  // Método para mover un estudiante hacia abajo en el orden de empate
  moveStudentDown(index: number): void {
    if (index < this.currentTieStudents.length - 1) {
      const temp = this.currentTieStudents[index];
      this.currentTieStudents[index] = this.currentTieStudents[index + 1];
      this.currentTieStudents[index + 1] = temp;
    }
  }

  // Método para confirmar el orden del grupo actual de empates
  confirmTieOrder(): void {
    // Actualizar el grupo actual con el nuevo orden
    this.tiedGroups[this.currentTieGroupIndex].students = [...this.currentTieStudents];

    // Pasar al siguiente grupo si existe
    if (this.currentTieGroupIndex < this.tiedGroups.length - 1) {
      this.currentTieGroupIndex++;
      this.currentTieStudents = [...this.tiedGroups[this.currentTieGroupIndex].students];
    } else {
      // Todos los grupos han sido resueltos, aplicar el nuevo orden
      this.applyTieResolution();
      this.closeTieResolutionModal();
    }
  }

  // Método para aplicar la resolución de empates al array principal
  applyTieResolution(): void {
    // Crear un nuevo array con el orden resuelto
    const resolvedOrder: Partial<RegistroEstudiante>[] = [];

    // Obtener estudiantes sin empates
    const untiedStudents = this.registrosEstudiantes.filter(estudiante => {
      const uve = estudiante.total_creditos || 0;
      return !this.tiedGroups.some(group => group.uve === uve);
    });

    // Combinar estudiantes sin empates y con empates resueltos, ordenados por UVE descendente
    const allStudents = [...untiedStudents];
    this.tiedGroups.forEach(group => {
      allStudents.push(...group.students);
    });

    // Reordenar por UVE descendente manteniendo el orden manual para empates
    const sortedStudents = allStudents.sort((a, b) => {
      const uveA = a.total_creditos || 0;
      const uveB = b.total_creditos || 0;

      if (uveA === uveB) {
        // Para estudiantes con la misma UVE, mantener el orden establecido manualmente
        const groupA = this.tiedGroups.find(g => g.uve === uveA);
        if (groupA) {
          const indexA = groupA.students.indexOf(a);
          const indexB = groupA.students.indexOf(b);
          return indexA - indexB;
        }
        return 0;
      }

      return uveB - uveA; // Descendente
    });

    // Reasignar porcentajes de descuento según el nuevo orden
    this.recalculateDiscountPercentages(sortedStudents);

    // Actualizar el array principal
    this.registrosEstudiantes = sortedStudents;
    this.manualOrderApplied = true;

    this.toastService.success(
      'Orden Aplicado',
      'El orden manual ha sido aplicado exitosamente. Los descuentos se han recalculado.',
      4000
    );
  }

  // Método para recalcular porcentajes de descuento
  recalculateDiscountPercentages(sortedStudents: Partial<RegistroEstudiante>[]): void {
    // Obtener los datos de apoyo familiar ordenados
    const apoyoFamiliarData = this.apoyoFamiliarService.currentData
      .sort((a: any, b: any) => a.orden - b.orden);

    sortedStudents.forEach((registro, index) => {
      const apoyo = apoyoFamiliarData[index] || null;
      registro.porcentaje_descuento = apoyo ? apoyo.porcentaje : 0;
    });
  }

  // Método para cerrar el modal de resolución de empates
  closeTieResolutionModal(): void {
    this.showTieResolutionModal = false;
    this.tiedGroups = [];
    this.currentTieGroupIndex = 0;
    this.currentTieStudents = [];
  }

  // Método para cancelar la resolución de empates
  cancelTieResolution(): void {
    this.closeTieResolutionModal();
    this.toastService.warning(
      'Resolución Cancelada',
      'Se canceló la resolución de empates. Se mantiene el orden original.',
      3000
    );
  }

  // Método para reabrir el modal de resolución de empates
  reopenTieResolution(): void {
    this.detectAndHandleTies();
  }

  // Drag & Drop Methods
  onDragStart(event: DragEvent, index: number): void {
    this.draggedIndex = index;
    if (event.dataTransfer) {
      event.dataTransfer.effectAllowed = 'move';
      event.dataTransfer.setData('text/html', ''); // Necesario para algunos navegadores
    }
  }

  onDragOver(event: DragEvent, index: number): void {
    event.preventDefault();
    this.dragOverIndex = index;
    if (event.dataTransfer) {
      event.dataTransfer.dropEffect = 'move';
    }
  }

  onDragLeave(): void {
    this.dragOverIndex = null;
  }

  onDrop(event: DragEvent, dropIndex: number): void {
    event.preventDefault();

    if (this.draggedIndex !== null && this.draggedIndex !== dropIndex) {
      // Reordenar el array
      const draggedStudent = this.currentTieStudents[this.draggedIndex];

      // Crear una nueva copia del array sin el elemento arrastrado
      const newOrder = this.currentTieStudents.filter((_, index) => index !== this.draggedIndex);

      // Insertar el elemento en la nueva posición
      newOrder.splice(dropIndex, 0, draggedStudent);

      // Actualizar el array
      this.currentTieStudents = newOrder;
    }

    // Resetear state
    this.draggedIndex = null;
    this.dragOverIndex = null;
  }

  onDragEnd(): void {
    this.draggedIndex = null;
    this.dragOverIndex = null;
  }

  // Helper methods for template
  getStudentsWithDiscount(): number {
    return this.registrosEstudiantes.filter(r => (r.porcentaje_descuento || 0) > 0).length;
  }

  isStudentInTieGroup(student: Partial<RegistroEstudiante>): boolean {
    if (!this.manualOrderApplied || !this.tiedGroups.length) {
      return false;
    }

    return this.tiedGroups.some(group =>
      group.students.some(s => s.ci_estudiante === student.ci_estudiante)
    );
  }

  // Helper para determinar si es flujo de apoyo familiar
  isApoyoFamiliar(): boolean {
    return this.flowType === 'apoyo-familiar';
  }

  // Helper para determinar si es flujo de otros beneficios
  isOtrosBeneficios(): boolean {
    return this.flowType === 'otros-beneficios';
  }

  // Obtener nombre del beneficio por ID
  getBeneficioNombre(id?: string): string {
    if (!id) return 'N/A';
    const beneficio = this.beneficioService.currentData.find(b => b.id === id);
    return beneficio?.nombre || 'N/A';
  }

  // Obtener título del reporte según el tipo de flujo
  getTituloReporte(): string {
    return this.isApoyoFamiliar() 
      ? 'REPORTE DE APOYO FAMILIAR ESTUDIANTIL'
      : 'REPORTE DE APOYOS, BECAS E INCENTIVOS';
  }

  // Obtener subtítulo del reporte según el tipo de flujo
  getSubtituloReporte(): string {
    return this.isApoyoFamiliar()
      ? 'Revisión Individual de Beneficios y Descuentos'
      : 'Asignación de Beneficios Individuales';
  }

  constructor(
    private toastService: ToastService,
    private dataService: RegistroIndividualDataService,
    private apoyoFamiliarService: ApoyoFamiliarService,
    private beneficioService: BeneficioService,
    private router: Router
  ) {}

  expandedItems: Set<number> = new Set();

  // Estados para feedback visual
  isSaving = false;
  isPrinting = false;

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

  async guardarRegistro(): Promise<void> {
    if (this.registrosEstudiantes.length === 0) {
      this.toastService.warning(
        'Sin Datos',
        'No hay registros disponibles para guardar'
      );
      return;
    }

    this.isSaving = true;

    try {
      // Verificar que las APIs están disponibles
      if (!window.academicoAPI?.createSolicitud || !window.academicoAPI?.createMultipleRegistroEstudiante) {
        throw new Error('APIs de base de datos no disponibles');
      }

      // STEP 1: Verificar beneficios existentes y detectar conflictos
      const conflictos = await this.verificarConflictosBeneficios();
      
      if (conflictos.tieneErrores) {
        this.isSaving = false;
        this.toastService.error(
          'Beneficios Duplicados',
          conflictos.mensajeError || 'Algunos estudiantes ya tienen el mismo beneficio registrado',
          8000
        );
        return;
      }

      // STEP 2: Si hay advertencias, pedir confirmación al usuario
      if (conflictos.tieneAdvertencias) {
        const confirmar = confirm(
          `⚠️ ADVERTENCIA:\n\n${conflictos.mensajeAdvertencia}\n\n¿Desea continuar? Los beneficios anteriores se marcarán como inactivos.`
        );
        
        if (!confirmar) {
          this.isSaving = false;
          return;
        }
      }

      // Si es flujo de otros beneficios (un solo estudiante), guardarlo directamente
      if (this.isOtrosBeneficios()) {
        await this.guardarBeneficioIndividual(conflictos.beneficiosAInactivar);
        return;
      }

      // Flujo de apoyo familiar (múltiples estudiantes con solicitud)
      await this.guardarApoyoFamiliar(conflictos.beneficiosAInactivar);

    } catch (error) {
      this.isSaving = false;
      console.error('❌ Error guardando registros:', error);

      let errorMessage = 'Error desconocido al guardar los registros';
      if (error instanceof Error) {
        errorMessage = error.message;
      }

      this.toastService.error(
        'Error al Guardar',
        `No se pudieron guardar los registros: ${errorMessage}. Por favor, intente nuevamente.`,
        8000
      );
    }
  }

  // Verificar conflictos con beneficios existentes
  async verificarConflictosBeneficios(): Promise<{
    tieneErrores: boolean;
    tieneAdvertencias: boolean;
    mensajeError?: string;
    mensajeAdvertencia?: string;
    beneficiosAInactivar: string[];
  }> {
    const beneficiosAInactivar: string[] = [];
    const errores: string[] = [];
    const advertencias: string[] = [];

    if (!window.academicoAPI?.checkExistingBenefitsBatch) {
      return { tieneErrores: false, tieneAdvertencias: false, beneficiosAInactivar };
    }

    try {
      // Obtener todos los CIs y la gestión
      const carnets = this.registrosEstudiantes
        .map(r => r.ci_estudiante)
        .filter(ci => ci) as string[];
      
      const gestionId = this.registrosEstudiantes[0]?.id_gestion || '';

      if (carnets.length === 0 || !gestionId) {
        return { tieneErrores: false, tieneAdvertencias: false, beneficiosAInactivar };
      }

      // Verificar beneficios existentes en batch
      const registrosExistentes = await window.academicoAPI.checkExistingBenefitsBatch(
        carnets,
        gestionId
      );

      // Crear mapa para búsqueda rápida
      const registrosMap = new Map<string, any>();
      registrosExistentes.forEach((reg: any) => {
        registrosMap.set(reg.ci_estudiante, reg);
      });

      // Verificar cada estudiante
      for (const registro of this.registrosEstudiantes) {
        const ci = registro.ci_estudiante;
        const idBeneficioNuevo = registro.id_beneficio;
        
        if (!ci || !idBeneficioNuevo) continue;

        const registroExistente = registrosMap.get(ci);

        if (registroExistente) {
          const beneficioExistenteNombre = this.getBeneficioNombre(registroExistente.id_beneficio);
          const beneficioNuevoNombre = this.getBeneficioNombre(idBeneficioNuevo);

          if (registroExistente.id_beneficio === idBeneficioNuevo) {
            // ERROR: Mismo beneficio
            errores.push(
              `${registro.nombre_estudiante}: Ya tiene el beneficio "${beneficioExistenteNombre}" (${(registroExistente.porcentaje_descuento * 100).toFixed(0)}%) registrado`
            );
          } else {
            // WARNING: Beneficio diferente
            advertencias.push(
              `${registro.nombre_estudiante}: Tiene "${beneficioExistenteNombre}" (${(registroExistente.porcentaje_descuento * 100).toFixed(0)}%), se reemplazará por "${beneficioNuevoNombre}"`
            );
            beneficiosAInactivar.push(registroExistente.id);
          }
        }
      }

      return {
        tieneErrores: errores.length > 0,
        tieneAdvertencias: advertencias.length > 0,
        mensajeError: errores.length > 0 ? errores.join('\n\n') : undefined,
        mensajeAdvertencia: advertencias.length > 0 ? advertencias.join('\n\n') : undefined,
        beneficiosAInactivar
      };

    } catch (error) {
      console.error('Error verificando conflictos:', error);
      return { tieneErrores: false, tieneAdvertencias: false, beneficiosAInactivar };
    }
  }

  // Método para guardar apoyo familiar con solicitud
  async guardarApoyoFamiliar(beneficiosAInactivar: string[]): Promise<void> {
    try {
      // STEP 1: Marcar beneficios anteriores como inactivos
      if (beneficiosAInactivar.length > 0) {
        console.log('[INACTIVAR] Marcando beneficios anteriores como inactivos:', beneficiosAInactivar);
        
        const updatePromises = beneficiosAInactivar.map(async (id) => {
          try {
            await window.academicoAPI!.updateRegistroEstudiante(id, { inactivo: true });
            console.log(`[INACTIVAR] Éxito para ID: ${id}`);
          } catch (error) {
            console.error(`[INACTIVAR] Error para ID ${id}:`, error);
          }
        });

        await Promise.allSettled(updatePromises);
      }

      // STEP 2: Crear la solicitud
      const gestionId = this.registrosEstudiantes[0]?.id_gestion || '581e078e-2c19-4d8f-a9f8-eb5ac388cb44';

      const solicitudData = {
        fecha: new Date().toISOString(),
        id_gestion: gestionId,
        estado: 'completado' as const,
        cantidad_estudiantes: this.registrosEstudiantes.length,
        comentarios: `Solicitud generada automáticamente para ${this.registrosEstudiantes.length} estudiante(s)`
      };

      const solicitud = await window.academicoAPI!.createSolicitud(solicitudData);

      if (!solicitud || !solicitud.id) {
        throw new Error('No se pudo crear la solicitud');
      }

      // STEP 3: Preparar los datos de los estudiantes con el ID de solicitud
      const registrosParaGuardar = this.registrosEstudiantes.map(registro => ({
        id_solicitud: solicitud.id,
        id_gestion: gestionId,
        id_estudiante_siaan: registro.id_estudiante_siaan || '',
        ci_estudiante: registro.ci_estudiante || '',
        nombre_estudiante: registro.nombre_estudiante || '',
        id_carrera: registro.id_carrera,
        id_beneficio: registro.id_beneficio,
        total_creditos: registro.total_creditos || 0,
        valor_credito: registro.valor_credito || 0,
        credito_tecnologico: registro.credito_tecnologico || 0,
        porcentaje_descuento: registro.porcentaje_descuento || 0,
        monto_primer_pago: registro.monto_primer_pago || 0,
        plan_primer_pago: registro.plan_primer_pago || '',
        pago_credito_tecnologico: registro.pago_credito_tecnologico,
        referencia_primer_pago: registro.referencia_primer_pago || 'SIN-REF',
        total_semestre: registro.total_semestre || 0,
        registrado: false,
        comentarios: registro.comentarios || '',
        pagos_realizados: registro.pagos_realizados
      }));

      // STEP 4: Guardar todos los registros de estudiantes
      await window.academicoAPI!.createMultipleRegistroEstudiante(registrosParaGuardar);

      this.isSaving = false;
      this.toastService.success(
        'Guardado Exitoso',
        `Se guardaron ${this.registrosEstudiantes.length} registros correctamente. ID de solicitud: ${solicitud.id}`,
        5000
      );

      // Marcar todos los registros como guardados
      this.registrosEstudiantes.forEach(registro => {
        registro.registrado = false;
        registro.id_solicitud = solicitud.id;
      });

    } catch (error) {
      throw error;
    }
  }

  // Método específico para guardar beneficios individuales (sin solicitud)
  async guardarBeneficioIndividual(beneficiosAInactivar: string[] = []): Promise<void> {
    try {
      if (!window.academicoAPI?.createMultipleRegistroEstudiante) {
        throw new Error('API de base de datos no disponible');
      }

      // STEP 1: Marcar beneficios anteriores como inactivos
      if (beneficiosAInactivar.length > 0) {
        console.log('[INACTIVAR] Marcando beneficios anteriores como inactivos:', beneficiosAInactivar);
        
        const updatePromises = beneficiosAInactivar.map(async (id) => {
          try {
            await window.academicoAPI!.updateRegistroEstudiante(id, { inactivo: true });
            console.log(`[INACTIVAR] Éxito para ID: ${id}`);
          } catch (error) {
            console.error(`[INACTIVAR] Error para ID ${id}:`, error);
          }
        });

        await Promise.allSettled(updatePromises);
      }

      // STEP 2: Guardar el nuevo beneficio
      const registro = this.registrosEstudiantes[0];
      const gestionId = registro?.id_gestion || '581e078e-2c19-4d8f-a9f8-eb5ac388cb44';

      const registroParaGuardar = {
        id_solicitud: null, // Sin solicitud para beneficios individuales
        id_gestion: gestionId,
        id_estudiante_siaan: registro.id_estudiante_siaan || '',
        ci_estudiante: registro.ci_estudiante || '',
        nombre_estudiante: registro.nombre_estudiante || '',
        id_carrera: registro.id_carrera,
        id_beneficio: registro.id_beneficio,
        total_creditos: registro.total_creditos || 0,
        valor_credito: registro.valor_credito || 0,
        credito_tecnologico: registro.credito_tecnologico || 0,
        porcentaje_descuento: registro.porcentaje_descuento || 0,
        monto_primer_pago: registro.monto_primer_pago || 0,
        plan_primer_pago: registro.plan_primer_pago || '',
        pago_credito_tecnologico: registro.pago_credito_tecnologico,
        referencia_primer_pago: registro.referencia_primer_pago || 'SIN-REF',
        pagos_realizados: registro.pagos_realizados,
        total_semestre: registro.total_semestre || 0,
        registrado: false,
        comentarios: registro.comentarios || null
      };

      await window.academicoAPI.createMultipleRegistroEstudiante([registroParaGuardar]);

      this.isSaving = false;
      
      const mensajeExtra = beneficiosAInactivar.length > 0 
        ? ' (beneficio anterior marcado como inactivo)'
        : '';
      
      this.toastService.success(
        'Guardado Exitoso',
        `Se guardó el beneficio individual para ${registro.nombre_estudiante}${mensajeExtra}`,
        5000
      );

      registro.registrado = false;

    } catch (error) {
      this.isSaving = false;
      console.error('❌ Error guardando beneficio individual:', error);

      let errorMessage = 'Error desconocido al guardar el beneficio';
      if (error instanceof Error) {
        errorMessage = error.message;
      }

      this.toastService.error(
        'Error al Guardar',
        `No se pudo guardar el beneficio: ${errorMessage}. Por favor, intente nuevamente.`,
        8000
      );
    }
  }






  // Helper para formatear moneda bolivian


}
