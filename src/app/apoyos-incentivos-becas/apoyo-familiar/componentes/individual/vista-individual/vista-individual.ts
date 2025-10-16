import { Component, OnInit, OnDestroy, inject } from '@angular/core';
import { RegistroEstudiante } from '../../../../interfaces/registro-estudiante';
import { Solicitud } from '../../../../interfaces/solicitud';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { ToastService } from '../../../../../shared/servicios/toast';
import { ToastContainerComponent } from '../../../../../shared/componentes/toast-container/toast-container';
import { Subject, takeUntil } from 'rxjs';
import { RegistroIndividualDataService } from '../../../../servicios/registro-individual-data';
import { ApoyoFamiliarService } from '../../../../servicios/apoyo-familiar.service';
import { StudentAccordionComponent } from '../../shared/student-accordion/student-accordion';
import { ExportActionsComponent } from '../../shared/export-actions/export-actions';
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
    // Suscribirse a los datos del servicio
    this.dataService.registrosEstudiantes$
      .pipe(takeUntil(this.destroy$))
      .subscribe(registros => {
        this.registrosEstudiantes = registros;
        // Detectar empates automáticamente cuando se cargan los datos
        if (registros.length > 0) {
          this.detectAndHandleTies();
        }
      });

    // Suscribirse al estado de validación de datos
    this.dataService.hasValidData$
      .pipe(takeUntil(this.destroy$))
      .subscribe(hasData => {
        this.hasValidData = hasData;
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  // Método para regresar a la vista de registro
  volverARegistro(): void {
    this.dataService.navigateToRegistro();
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

  constructor(
    private toastService: ToastService,
    private dataService: RegistroIndividualDataService,
    private apoyoFamiliarService: ApoyoFamiliarService
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


      // Debug: Primero intentar obtener todas las solicitudes para ver la estructura
      try {
        const existingSolicitudes = await window.academicoAPI.getAllSolicitud();
      } catch (debugError) {
        console.log('⚠️ No se pudieron obtener solicitudes existentes:', debugError);
      }

      // Obtener el ID de gestión del primer registro o usar valor por defecto
      const gestionId = this.registrosEstudiantes[0]?.id_gestion || '581e078e-2c19-4d8f-a9f8-eb5ac388cb44';

      // Paso 1: Crear la solicitud
      const solicitudData = {
        fecha: new Date().toISOString(),
        id_gestion: gestionId,
        estado: 'completado' as const,
        cantidad_estudiantes: this.registrosEstudiantes.length,
        comentarios: `Solicitud generada automáticamente para ${this.registrosEstudiantes.length} estudiante(s)`
      };

      const solicitud = await window.academicoAPI.createSolicitud(solicitudData);

      if (!solicitud || !solicitud.id) {
        throw new Error('No se pudo crear la solicitud');
      }


      // Paso 2: Preparar los datos de los estudiantes con el ID de solicitud
      const registrosParaGuardar = this.registrosEstudiantes.map(registro => ({
        id_solicitud: solicitud.id,
        id_gestion: gestionId,
        id_estudiante_siaan: registro.id_estudiante_siaan || '',
        ci_estudiante: registro.ci_estudiante || '',
        nombre_estudiante: registro.nombre_estudiante || '',
        id_carrera: registro.id_carrera, // Campo principal - ID de carrera
        id_beneficio: registro.id_beneficio, // ID del beneficio "APOYO FAMILIAR"
        total_creditos: registro.total_creditos || 0,
        valor_credito: registro.valor_credito || 0,
        credito_tecnologico: registro.credito_tecnologico || 0,
        porcentaje_descuento: registro.porcentaje_descuento || 0,
        monto_primer_pago: registro.monto_primer_pago || 0,
        plan_primer_pago: registro.plan_primer_pago || '',
        referencia_primer_pago: registro.referencia_primer_pago || 'SIN-REF',
        total_semestre: registro.total_semestre || 0,
        registrado: false,
        comentarios: registro.comentarios || ''
      }));


      // Paso 3: Guardar todos los registros de estudiantes
      const registrosGuardados = await window.academicoAPI.createMultipleRegistroEstudiante(registrosParaGuardar);


      this.isSaving = false;
      this.toastService.success(
        'Guardado Exitoso',
        `Se guardaron ${this.registrosEstudiantes.length} registros correctamente en la base de datos. ID de solicitud: ${solicitud.id}`,
        5000
      );

      // Opcional: Marcar todos los registros como guardados
      this.registrosEstudiantes.forEach(registro => {
        registro.registrado = false;
        registro.id_solicitud = solicitud.id;
      });

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

  imprimirReporte(): void {
    console.log('🖨️ Iniciando proceso de impresión...');

    if (this.registrosEstudiantes.length === 0) {
      this.toastService.warning(
        'Sin Datos',
        'No hay registros disponibles para imprimir'
      );
      return;
    }

    this.isPrinting = true;
    console.log('🔄 Estado de impresión activado');

    // Timeout de seguridad para resetear el estado
    const safetyTimeout = setTimeout(() => {
      if (this.isPrinting) {
        console.log('⏰ Timeout de seguridad activado - reseteando estado');
        this.isPrinting = false;
        this.toastService.warning(
          'Tiempo de Espera Agotado',
          'La impresión está tomando más tiempo del esperado. Intente nuevamente.'
        );
      }
    }, 10000); // 10 segundos

    try {
      // Generar el contenido HTML para imprimir
      const printContent = this.generatePrintHTML();
      console.log('📄 Contenido HTML generado, longitud:', printContent.length);

      // Verificar si las APIs de Electron están disponibles
      console.log('🔍 Verificando APIs disponibles...');
      console.log('window.electronAPI:', typeof (window as any).electronAPI);
      console.log('window.academicoAPI:', typeof (window as any).academicoAPI);

      // Usar las APIs de Electron para imprimir
      if (typeof window !== 'undefined' && (window as any).electronAPI) {
        console.log('✅ API de Electron detectada, usando impresión nativa');
        //this.printWithElectron(printContent, safetyTimeout);
      } else {
        console.log('⚠️ API de Electron no disponible, usando fallback de navegador');
        //this.printWithBrowser(printContent, safetyTimeout);
      }

    } catch (error) {
      console.error('❌ Error en imprimirReporte:', error);
      clearTimeout(safetyTimeout);
      this.isPrinting = false;
      this.toastService.error(
        'Error en Impresión',
        'Ocurrió un error al preparar el documento para imprimir. Por favor, intente nuevamente.'
      );
    }
  }

  private async printWithElectron(content: string, safetyTimeout?: number): Promise<void> {
    console.log('🔧 Iniciando impresión con Electron...');

    try {
      // Usar la API de Electron para imprimir
      console.log('📤 Enviando contenido a Electron para impresión');
      const result = await (window as any).electronAPI.print(content);
      console.log('📥 Respuesta de Electron:', result);

      if (safetyTimeout) clearTimeout(safetyTimeout);
      this.isPrinting = false;

      if (result.success) {
        console.log('✅ Impresión exitosa');
        this.toastService.success(
          'Documento Enviado a Impresión',
          'El reporte se ha enviado exitosamente a la impresora'
        );
      } else {
        console.log('⚠️ Impresión cancelada o falló');
        this.toastService.warning(
          'Impresión Cancelada',
          result.error || 'La impresión fue cancelada por el usuario'
        );
      }
    } catch (error) {
      console.error('❌ Error en printWithElectron:', error);
      if (safetyTimeout) clearTimeout(safetyTimeout);
      this.isPrinting = false;
      this.toastService.error(
        'Error de Impresión',
        'Error al comunicarse con el sistema de impresión'
      );
    }
  }

  private printWithBrowser(content: string, safetyTimeout?: number): void {
    console.log('🌐 Iniciando impresión con navegador (fallback)...');

    try {
      // Fallback para navegador (desarrollo)
      const printWindow = window.open('', '_blank', 'width=800,height=600,scrollbars=yes,resizable=yes');

      if (printWindow) {
        console.log('🪟 Ventana de impresión abierta');
        printWindow.document.write(content);
        printWindow.document.close();

        printWindow.onload = () => {
          console.log('📄 Contenido cargado en ventana de impresión');
          setTimeout(() => {
            if (safetyTimeout) clearTimeout(safetyTimeout);
            this.isPrinting = false;
            printWindow.print();

            // Cerrar después de un tiempo
            setTimeout(() => {
              if (!printWindow.closed) {
                printWindow.close();
              }
            }, 1000);

            this.toastService.success(
              'Vista de Impresión Abierta',
              'Use Ctrl+P para imprimir el documento'
            );
          }, 500);
        };

        printWindow.onerror = (error) => {
          console.error('❌ Error en ventana de impresión:', error);
          if (safetyTimeout) clearTimeout(safetyTimeout);
          this.isPrinting = false;
          this.toastService.error(
            'Error de Impresión',
            'Error al cargar el documento en la ventana de impresión'
          );
        };

      } else {
        console.error('❌ No se pudo crear ventana de impresión');
        if (safetyTimeout) clearTimeout(safetyTimeout);
        this.isPrinting = false;
        this.toastService.error(
          'Error de Impresión',
          'No se pudo abrir la ventana de impresión. Verifique que los popups estén habilitados.'
        );
      }
    } catch (error) {
      console.error('❌ Error en printWithBrowser:', error);
      if (safetyTimeout) clearTimeout(safetyTimeout);
      this.isPrinting = false;
      this.toastService.error(
        'Error de Impresión',
        'Error al preparar la impresión en el navegador'
      );
    }
  }

  private generatePrintHTML(): string {
    const fecha = new Date().toLocaleDateString('es-ES');
    const hora = new Date().toLocaleTimeString('es-ES');

    let html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Reporte de Apoyo Familiar Estudiantil</title>
        <style>
          body {
            font-family: Arial, sans-serif;
            margin: 20px;
            padding: 0;
            background: white;
            color: black;
            font-size: 12px;
            line-height: 1.4;
          }

          .header {
            text-align: center;
            margin-bottom: 30px;
            border-bottom: 2px solid #3B82F6;
            padding-bottom: 15px;
          }

          .header h1 {
            font-size: 18px;
            color: #1E3A8A;
            margin: 0 0 5px 0;
          }

          .header h2 {
            font-size: 14px;
            color: #374151;
            margin: 0 0 10px 0;
            font-weight: normal;
          }

          .header .date {
            font-size: 10px;
            color: #6B7280;
          }

          .student-section {
            margin-bottom: 35px;
            page-break-inside: avoid;
          }

          .student-header {
            background: #EFF6FF;
            border: 2px solid #3B82F6;
            padding: 12px;
            margin-bottom: 15px;
            border-radius: 4px;
          }

          .student-title {
            font-size: 14px;
            font-weight: bold;
            color: #1E3A8A;
            margin-bottom: 8px;
          }

          .student-info {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 12px;
          }

          .info-item {
            font-size: 11px;
          }

          .info-label {
            font-weight: bold;
            color: #374151;
          }

          .financial-table {
            width: 100%;
            border-collapse: collapse;
            margin: 15px 0;
            font-size: 10px;
          }

          .financial-table th {
            background: #3B82F6;
            color: white;
            padding: 8px 6px;
            text-align: center;
            font-weight: bold;
            font-size: 10px;
          }

          .financial-table td {
            padding: 6px;
            border: 1px solid #D1D5DB;
            font-size: 10px;
          }

          .financial-table tr:nth-child(even) {
            background: #F8FAFC;
          }

          .concept-cell {
            font-weight: bold;
            text-align: left;
          }

          .number-cell {
            text-align: right;
          }

          .difference-cell {
            text-align: right;
            color: #059669;
            font-weight: bold;
          }

          .payment-section {
            background: #FFFBEB;
            border: 2px solid #F59E0B;
            padding: 10px;
            margin-top: 15px;
            border-radius: 4px;
          }

          .payment-title {
            font-size: 11px;
            font-weight: bold;
            color: #92400E;
            margin-bottom: 8px;
          }

          .payment-info {
            display: grid;
            grid-template-columns: 1fr 1fr 1fr;
            gap: 8px;
            font-size: 9px;
          }

          .footer {
            margin-top: 30px;
            text-align: center;
            font-size: 9px;
            color: #6B7280;
            border-top: 1px solid #D1D5DB;
            padding-top: 10px;
          }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>REPORTE DE APOYO FAMILIAR ESTUDIANTIL</h1>
          <h2>Revisión Individual de Beneficios y Descuentos</h2>
          <div class="date">Generado el ${fecha} a las ${hora}</div>
        </div>
    `;

    // Agregar cada estudiante
    this.registrosEstudiantes.forEach((registro, index) => {
      html += this.generateStudentHTML(registro, index + 1);
    });

    html += `
        <div class="footer">
          Servicio Académico Administrativo Estudiantil - SAAE | Total de registros: ${this.registrosEstudiantes.length}
        </div>
      </body>
      </html>
    `;

    return html;
  }

  private generateStudentHTML(registro: Partial<RegistroEstudiante>, numeroEstudiante: number): string {
    const tableData = this.prepareStudentTableData(registro);

    let html = `
      <div class="student-section">
        <div class="student-header">
          <div class="student-title">ESTUDIANTE ${numeroEstudiante}</div>
          <div class="student-info">
            <div class="info-item">
              <span class="info-label">CI:</span> ${registro.ci_estudiante || 'N/A'}
            </div>
            <div class="info-item">
              <span class="info-label">Nombre:</span> ${registro.nombre_estudiante || 'N/A'}
            </div>
            <div class="info-item">
              <span class="info-label">Total U.V.E.:</span> ${registro.total_creditos || 0}
            </div>
            <div class="info-item">
              <span class="info-label">Carrera:</span> ${registro.carrera || 'N/A'}
            </div>
          </div>
        </div>

        <table class="financial-table">
          <thead>
            <tr>
              <th>Concepto</th>
              <th>Plan Original</th>
              <th>Plan con Descuento</th>
              <th>Diferencia</th>
            </tr>
          </thead>
          <tbody>
    `;

    tableData.forEach(row => {
      html += `
        <tr>
          <td class="concept-cell">${row[0]}</td>
          <td class="number-cell">${row[1]}</td>
          <td class="number-cell">${row[2]}</td>
          <td class="difference-cell">${row[3]}</td>
        </tr>
      `;
    });

    html += `
          </tbody>
        </table>
    `;

    // Información de pago si existe
    if (registro.plan_primer_pago) {
      html += `
        <div class="payment-section">
          <div class="payment-title">INFORMACIÓN DE PAGO</div>
          <div class="payment-info">
            <div><strong>Plan:</strong> ${registro.plan_primer_pago}</div>
            <div><strong>Monto:</strong> BOB. ${(registro.monto_primer_pago || 0).toFixed(2)}</div>
            <div><strong>Referencia:</strong> ${registro.referencia_primer_pago || 'N/A'}</div>
          </div>
        </div>
      `;
    }

    html += `</div>`;

    return html;
  }

  private prepareStudentTableData(registro: Partial<RegistroEstudiante>): string[][] {
    const valorCredito = registro.valor_credito || 0;
    const totalCreditos = registro.total_creditos || 0;
    const creditoTecnologico = registro.credito_tecnologico || 0;
    const porcentajeDescuento = registro.porcentaje_descuento || 0;
    const montoPrimerPago = registro.monto_primer_pago || 0;
    const totalSemestre = registro.total_semestre || 0;

    // Cálculos originales
    const derechosAcademicosOriginales = valorCredito * totalCreditos;
    const totalOriginal = totalSemestre;
    const saldoOriginal = totalOriginal - montoPrimerPago;

    // Cálculos con descuento
    const derechosAcademicosConDescuento = derechosAcademicosOriginales * (1 - porcentajeDescuento);
    const totalConDescuento = derechosAcademicosConDescuento + creditoTecnologico;
    const saldoConDescuento = totalConDescuento - montoPrimerPago;

    // Diferencias (ahorros)
    const ahorroDerechosAcademicos = derechosAcademicosOriginales - derechosAcademicosConDescuento;
    const ahorroTotal = totalOriginal - totalConDescuento;
    const ahorroSaldo = saldoOriginal - saldoConDescuento;

    return [
      [
        'Valor por U.V.E.',
        `BOB. ${valorCredito.toFixed(2)}`,
        `BOB. ${valorCredito.toFixed(2)}`,
        'BOB. 0.00'
      ],
      [
        'Total U.V.E.',
        `${totalCreditos}`,
        `${totalCreditos}`,
        '0'
      ],
      [
        'Derechos Académicos',
        `BOB. ${derechosAcademicosOriginales.toFixed(2)}`,
        `BOB. ${derechosAcademicosConDescuento.toFixed(2)}`,
        `BOB. ${ahorroDerechosAcademicos.toFixed(2)}`
      ],
      [
        'Crédito Tecnológico',
        `BOB. ${creditoTecnologico.toFixed(2)}`,
        `BOB. ${creditoTecnologico.toFixed(2)}`,
        'BOB. 0.00'
      ],
      [
        'Total Semestre',
        `BOB. ${totalOriginal.toFixed(2)}`,
        `BOB. ${totalConDescuento.toFixed(2)}`,
        `BOB. ${ahorroTotal.toFixed(2)}`
      ],
      [
        'Derecho de Inscripción',
        `BOB. ${montoPrimerPago.toFixed(2)}`,
        `BOB. ${montoPrimerPago.toFixed(2)}`,
        'BOB. 0.00'
      ],
      [
        'Saldo Semestre',
        `BOB. ${saldoOriginal.toFixed(2)}`,
        `BOB. ${saldoConDescuento.toFixed(2)}`,
        `BOB. ${ahorroSaldo.toFixed(2)}`
      ],
      [
        'Descuento Aplicado',
        '0%',
        `${(porcentajeDescuento * 100).toFixed(1)}%`,
        `${(porcentajeDescuento * 100).toFixed(1)}%`
      ]
    ];
  }
}
