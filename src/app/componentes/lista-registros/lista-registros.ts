import { Component, OnInit, OnDestroy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule, Router } from '@angular/router';
import { RegistroEstudiante } from '../../interfaces/registro-estudiante';
import { Gestion } from '../../interfaces/gestion';
import { Carrera } from '../../interfaces/carrera';
import { Solicitud } from '../../interfaces/solicitud';
import { ApoyoFamiliar } from '../../interfaces/apoyo-familiar';
import { ToastService } from '../../servicios/toast';
import { ToastContainerComponent } from '../shared/toast-container/toast-container';
import { MultiSelectDropdownComponent, MultiSelectOption } from '../shared/multi-select-dropdown/multi-select-dropdown';
import { StudentAccordionComponent } from '../shared/student-accordion/student-accordion';
import { ExportActionsComponent } from '../shared/export-actions/export-actions';
import { ExportConfigModalComponent } from '../shared/export-config-modal/export-config-modal';
import { CarreraService } from '../../servicios/carrera.service';
import { GestionService } from '../../servicios/gestion.service';
import { Subject, takeUntil, debounceTime, distinctUntilChanged } from 'rxjs';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import '../../interfaces/electron-api';
import { ExportConfig, ExportColumn } from '../../interfaces/export-config';
// Logo institucional centralizado reutilizado para encabezados de reportes PDF
import { LOGO_BASE64 } from '../../constantes/logo-base64';

interface RegistroConSolicitud extends RegistroEstudiante {
  solicitudInfo?: Solicitud;
}

interface SolicitudAgrupada {
  solicitud: Solicitud;
  registros: RegistroConSolicitud[];
  expanded: boolean;
}

@Component({
  selector: 'app-lista-registros',
  imports: [CommonModule, FormsModule, RouterModule, ToastContainerComponent, MultiSelectDropdownComponent, StudentAccordionComponent, ExportActionsComponent, ExportConfigModalComponent],
  templateUrl: './lista-registros.html',
  styleUrl: './lista-registros.scss'
})
export class ListaRegistrosComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();
  private readonly COMMENT_PREVIEW_LIMIT = 100;

  // Datos principales
  registrosEstudiantes: RegistroEstudiante[] = [];
  solicitudesAgrupadas: SolicitudAgrupada[] = [];
  solicitudesOriginales: SolicitudAgrupada[] = [];
  solicitudesFiltradasTotales: SolicitudAgrupada[] = [];
  gestiones: Gestion[] = [];
  carreras: Carrera[] = [];
  solicitudes: Solicitud[] = [];
  apoyosFamiliares: ApoyoFamiliar[] = [];

  //Servicios
  carreraService = inject(CarreraService);
  gestionService = inject(GestionService);
  // Estados de loading
  isLoading = false;
  isLoadingFiltros = false;

  // Estados de dropdowns
  isGestionDropdownOpen = false;
  isCarreraDropdownOpen = false;

  // Filtros
  filtroGestion: string[] = [];
  filtroBusqueda = '';
  filtroCarrera: string[] = [];
  filtroDescuento: string[] = [];
  filtroPlan: string[] = [];
  
  // Configuración de filtrado
  mostrarSoloEstudiantesFiltrados = true; // false = mostrar toda la solicitud, true = solo estudiantes filtrados

  // Vista detallada de solicitud
  showDetailModal = false;
  selectedSolicitud: SolicitudAgrupada | null = null;
  expandedDetailItems: Set<number> = new Set();
  
  // Estados para exportación desde vista detallada
  isExportingDetail = false;
  isGeneratingPDFDetail = false;

  // Modal de edición de registros
  editingRegistroId: string | null = null;
  registroEnEdicion: RegistroConSolicitud | null = null;
  editForm = {
    comentarios: '',
    registrado: false
  };
  isSavingRegistro = false;
  showEditModal = false;
  comentariosExpandido = new Set<string>();
  isExportingListadoExcel = false;
  isGeneratingListadoPDF = false;
  showListadoExportModal = false;
  exportConfigListado: ExportConfig = this.crearConfigExportacionPorDefecto();

  // Dropdown options
  gestionOptions: MultiSelectOption[] = [];
  carreraOptions: MultiSelectOption[] = [];
  descuentoOptions: MultiSelectOption[] = [];
  planOptions: MultiSelectOption[] = [];

  // Paginación
  currentPage = 1;
  itemsPerPage = 10;
  totalItems = 0;

  constructor(private toastService: ToastService, private router: Router) {}

  // Método para regresar al menú principal
  volverAlMenu(): void {
    this.router.navigate(['/menu']);
  }

  ngOnInit(): void {
    this.cargarDatos();
    this.cargarFiltrosDatos();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  async cargarDatos(): Promise<void> {
    try {
      this.isLoading = true;

      // Verificar APIs disponibles
      if (!window.academicoAPI?.getAllRegistroEstudiante || !window.academicoAPI?.getAllSolicitud) {
        throw new Error('APIs de base de datos no disponibles');
      }

      // Cargar registros y solicitudes
      const [registros, solicitudes] = await Promise.all([
        window.academicoAPI.getAllRegistroEstudiante(),
        window.academicoAPI.getAllSolicitud()
      ]);

      this.registrosEstudiantes = registros || [];
      this.solicitudes = solicitudes || [];
      
      // Agrupar por solicitud
      this.agruparPorSolicitud();
      
      this.aplicarFiltros();

    } catch (error) {
      console.error('❌ Error cargando datos:', error);
      this.toastService.error(
        'Error de Carga',
        'No se pudieron cargar los registros de estudiantes'
      );
    } finally {
      this.isLoading = false;
    }
  }

  async cargarFiltrosDatos(): Promise<void> {
    try {
      this.isLoadingFiltros = true;

      // Filtrar solo gestiones semestrales y ordenarlas según criterio de BD
      const todasLasGestiones = this.gestionService.currentData || [];
      this.gestiones = todasLasGestiones
        .filter(gestion => gestion.tipo === 'Semestre')
        .sort((a, b) => {
          // ORDER BY anio DESC, tipo ASC, gestion DESC
          if (a.anio !== b.anio) {
            return b.anio - a.anio; // DESC (mayor a menor)
          }
          if (a.tipo !== b.tipo) {
            return a.tipo.localeCompare(b.tipo); // ASC
          }
          return b.gestion.localeCompare(a.gestion); // DESC
        });
      
      // Filtrar solo carreras visibles
      const todasLasCarreras = this.carreraService.currentData || [];
      this.carreras = todasLasCarreras.filter(carrera => carrera.visible === true);

      // Cargar apoyos familiares desde la API
      if (window.academicoAPI) {
        this.apoyosFamiliares = await window.academicoAPI.getAllApoyoFamiliar();
      }

      // Create dropdown options
      this.gestionOptions = this.gestiones.map(gestion => ({
        value: gestion.id,
        label: gestion.gestion
      }));

      this.carreraOptions = this.carreras.map(carrera => ({
        value: carrera.carrera,
        label: carrera.carrera
      }));

      this.descuentoOptions = this.apoyosFamiliares.map(apoyo => ({
        value: apoyo.porcentaje.toString(),
        label: `${apoyo.porcentaje * 100}%`
      }));

      this.planOptions = [
        { value: 'Plan Estandar', label: 'Plan Estandar' },
        { value: 'Plan Plus', label: 'Plan Plus' }
      ];

    } catch (error) {
      console.error('❌ Error cargando datos de filtros:', error);
    } finally {
      this.isLoadingFiltros = false;
    }
  }

  agruparPorSolicitud(): void {
    this.comentariosExpandido.clear();
    // Crear un mapa de solicitudes por ID
    const solicitudesMap = new Map<string, Solicitud>();
    this.solicitudes.forEach(solicitud => {
      if (solicitud.id) {
        solicitudesMap.set(solicitud.id, solicitud);
      }
    });

    // Agrupar registros por id_solicitud
    const gruposMap = new Map<string, RegistroEstudiante[]>();
    
    this.registrosEstudiantes.forEach(registro => {
      const solicitudId = registro.id_solicitud;
      if (!gruposMap.has(solicitudId)) {
        gruposMap.set(solicitudId, []);
      }
      gruposMap.get(solicitudId)!.push(registro);
    });

    // Crear solicitudes agrupadas con información combinada
    this.solicitudesAgrupadas = Array.from(gruposMap.entries()).map(([solicitudId, registros]) => {
      const solicitud = solicitudesMap.get(solicitudId) || {
        id: solicitudId,
        fecha: new Date().toISOString(),
        id_gestion: registros[0]?.id_gestion || '',
        estado: 'desconocido',
        cantidad_estudiantes: registros.length,
        comentarios: 'Solicitud no encontrada'
      };

      // Combinar cada registro con la información de solicitud
      const registrosConSolicitud = registros.map(registro => ({
        ...registro,
        solicitudInfo: solicitud as Solicitud
      } as RegistroConSolicitud));

      return {
        solicitud: solicitud as Solicitud,
        registros: this.ordenarRegistrosPorDescuento(registrosConSolicitud),
        expanded: true // Por defecto expandido para formato tabla
      };
    }).sort((a, b) => new Date(b.solicitud.fecha).getTime() - new Date(a.solicitud.fecha).getTime());

    // Guardar una copia para filtros
    this.solicitudesOriginales = [...this.solicitudesAgrupadas];
  }

  aplicarFiltros(): void {
    // Partir desde las solicitudes originales
    let solicitudesFiltradas = [...this.solicitudesOriginales];

    if (this.mostrarSoloEstudiantesFiltrados) {
      // Modo: Solo estudiantes filtrados
      // Filtrar estudiantes individuales y reagrupar por solicitud
      solicitudesFiltradas = this.aplicarFiltrosPorEstudiante(solicitudesFiltradas);
    } else {
      // Modo: Mostrar toda la solicitud si al menos un estudiante cumple
      solicitudesFiltradas = this.aplicarFiltrosPorSolicitud(solicitudesFiltradas);
    }

    this.solicitudesFiltradasTotales = solicitudesFiltradas;

    // Aplicar paginación
    this.totalItems = solicitudesFiltradas.length;
    const startIndex = (this.currentPage - 1) * this.itemsPerPage;
    this.solicitudesAgrupadas = solicitudesFiltradas.slice(startIndex, startIndex + this.itemsPerPage);
  }

  private aplicarFiltrosPorSolicitud(solicitudes: SolicitudAgrupada[]): SolicitudAgrupada[] {
    let solicitudesFiltradas = [...solicitudes];

    // Filtro por gestión (multi-select)
    if (this.filtroGestion.length > 0) {
      solicitudesFiltradas = solicitudesFiltradas.filter(item => 
        this.filtroGestion.includes(item.solicitud.id_gestion)
      );
    }

    // Filtro por carrera (multi-select)
    if (this.filtroCarrera.length > 0) {
      solicitudesFiltradas = solicitudesFiltradas.filter(item =>
        item.registros.some((registro: RegistroConSolicitud) => 
          this.filtroCarrera.some(carrera => 
            registro.carrera.toLowerCase().includes(carrera.toLowerCase())
          )
        )
      );
    }

    // Filtro por descuento de apoyo familiar (multi-select)
    if (this.filtroDescuento.length > 0) {
      solicitudesFiltradas = solicitudesFiltradas.filter(item =>
        item.registros.some((registro: RegistroConSolicitud) => 
          this.filtroDescuento.includes(registro.porcentaje_descuento.toString())
        )
      );
    }

    if (this.filtroPlan.length > 0) {
      solicitudesFiltradas = solicitudesFiltradas.filter(item =>
        item.registros.some(registro => this.coincidePlanFiltro(registro.plan_primer_pago))
      );
    }

    // Filtro por búsqueda (nombre o carnet)
    if (this.filtroBusqueda.trim()) {
      const busqueda = this.filtroBusqueda.toLowerCase().trim();
      solicitudesFiltradas = solicitudesFiltradas.filter(item =>
        item.registros.some((registro: RegistroConSolicitud) => 
          registro.nombre_estudiante.toLowerCase().includes(busqueda) ||
          registro.ci_estudiante.toLowerCase().includes(busqueda)
        )
      );
    }

    return solicitudesFiltradas;
  }

  private aplicarFiltrosPorEstudiante(solicitudes: SolicitudAgrupada[]): SolicitudAgrupada[] {
    const solicitudesFiltradas: SolicitudAgrupada[] = [];

    for (const item of solicitudes) {
      // Filtro por gestión
      if (this.filtroGestion.length > 0 && !this.filtroGestion.includes(item.solicitud.id_gestion)) {
        continue;
      }

      // Filtrar estudiantes que cumplen todos los criterios
      let registrosFiltrados = [...item.registros];

      // Filtro por carrera
      if (this.filtroCarrera.length > 0) {
        registrosFiltrados = registrosFiltrados.filter((registro: RegistroConSolicitud) =>
          this.filtroCarrera.some(carrera => 
            registro.carrera.toLowerCase().includes(carrera.toLowerCase())
          )
        );
      }

      // Filtro por descuento
      if (this.filtroDescuento.length > 0) {
        registrosFiltrados = registrosFiltrados.filter((registro: RegistroConSolicitud) =>
          this.filtroDescuento.includes(registro.porcentaje_descuento.toString())
        );
      }

      // Filtro por plan de pago
      if (this.filtroPlan.length > 0) {
        registrosFiltrados = registrosFiltrados.filter(registro => this.coincidePlanFiltro(registro.plan_primer_pago));
      }

      // Filtro por búsqueda
      if (this.filtroBusqueda.trim()) {
        const busqueda = this.filtroBusqueda.toLowerCase().trim();
        registrosFiltrados = registrosFiltrados.filter((registro: RegistroConSolicitud) =>
          registro.nombre_estudiante.toLowerCase().includes(busqueda) ||
          registro.ci_estudiante.toLowerCase().includes(busqueda)
        );
      }

      // Si hay estudiantes que cumplen los criterios, incluir la solicitud con solo esos estudiantes
      if (registrosFiltrados.length > 0) {
        solicitudesFiltradas.push({
          ...item,
          registros: registrosFiltrados
        });
      }
    }

    return solicitudesFiltradas;
  }

  onFiltroChange(): void {
    this.currentPage = 1; // Resetear a primera página
    this.aplicarFiltros();
  }

  limpiarFiltros(): void {
    this.filtroGestion = [];
    this.filtroBusqueda = '';
    this.filtroCarrera = [];
    this.filtroDescuento = [];
    this.filtroPlan = [];
    this.currentPage = 1;
    this.aplicarFiltros();
  }

  // Métodos de paginación
  get totalPages(): number {
    return Math.ceil(this.totalItems / this.itemsPerPage);
  }

  get pages(): number[] {
    const pages = [];
    for (let i = 1; i <= this.totalPages; i++) {
      pages.push(i);
    }
    return pages;
  }

  goToPage(page: number): void {
    if (page >= 1 && page <= this.totalPages) {
      this.currentPage = page;
      this.aplicarFiltros();
    }
  }

  previousPage(): void {
    if (this.currentPage > 1) {
      this.currentPage--;
      this.aplicarFiltros();
    }
  }

  nextPage(): void {
    if (this.currentPage < this.totalPages) {
      this.currentPage++;
      this.aplicarFiltros();
    }
  }

  // Métodos utilitarios
  formatearFecha(fecha: string): string {
    try {
      return new Date(fecha).toLocaleDateString('es-ES', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return fecha;
    }
  }

  getEstadoBadgeClass(estado: string): string {
    switch (estado?.toLowerCase()) {
      case 'completado':
        return 'bg-green-500 text-white';
      case 'pendiente':
        return 'bg-yellow-500 text-white';
      case 'procesado':
        return 'bg-blue-500 text-white';
      case 'cancelado':
        return 'bg-red-500 text-white';
      default:
        return 'bg-gray-500 text-white';
    }
  }

  getNombreGestion(idGestion: string): string {
    const gestion = this.gestiones.find(g => g.id === idGestion);
    return gestion?.gestion || idGestion;
  }

  getTotalEstudiantes(): number {
    return this.solicitudesAgrupadas.reduce((total, item) => total + item.registros.length, 0);
  }

  // Métodos para dropdowns personalizados
  toggleGestionDropdown(): void {
    this.isGestionDropdownOpen = !this.isGestionDropdownOpen;
    if (this.isGestionDropdownOpen) {
      this.isCarreraDropdownOpen = false;
    }
  }

  toggleCarreraDropdown(): void {
    this.isCarreraDropdownOpen = !this.isCarreraDropdownOpen;
    if (this.isCarreraDropdownOpen) {
      this.isGestionDropdownOpen = false;
    }
  }

  closeDropdowns(): void {
    this.isGestionDropdownOpen = false;
    this.isCarreraDropdownOpen = false;
  }

  toggleGestion(gestionId: string): void {
    const index = this.filtroGestion.indexOf(gestionId);
    if (index > -1) {
      this.filtroGestion.splice(index, 1);
    } else {
      this.filtroGestion.push(gestionId);
    }
    this.onFiltroChange();
  }

  toggleCarrera(carrera: string): void {
    const index = this.filtroCarrera.indexOf(carrera);
    if (index > -1) {
      this.filtroCarrera.splice(index, 1);
    } else {
      this.filtroCarrera.push(carrera);
    }
    this.onFiltroChange();
  }

  selectAllGestiones(): void {
    if (this.filtroGestion.length === this.gestiones.length) {
      this.filtroGestion = [];
    } else {
      this.filtroGestion = this.gestiones.map(g => g.id);
    }
    this.onFiltroChange();
  }

  selectAllCarreras(): void {
    if (this.filtroCarrera.length === this.carreras.length) {
      this.filtroCarrera = [];
    } else {
      this.filtroCarrera = this.carreras.map(c => c.carrera);
    }
    this.onFiltroChange();
  }

  isGestionSelected(gestionId: string): boolean {
    return this.filtroGestion.includes(gestionId);
  }

  isCarreraSelected(carrera: string): boolean {
    return this.filtroCarrera.includes(carrera);
  }

  getGestionDropdownText(): string {
    if (this.filtroGestion.length === 0) return 'Seleccionar gestiones';
    if (this.filtroGestion.length === 1) {
      const gestion = this.gestiones.find(g => g.id === this.filtroGestion[0]);
      return gestion?.gestion || 'Gestión seleccionada';
    }
    return `${this.filtroGestion.length} gestiones seleccionadas`;
  }

  getCarreraDropdownText(): string {
    if (this.filtroCarrera.length === 0) return 'Seleccionar carreras';
    if (this.filtroCarrera.length === 1) {
      return this.filtroCarrera[0];
    }
    return `${this.filtroCarrera.length} carreras seleccionadas`;
  }

  // New component event handlers
  onGestionSelectionChange(selectedValues: string[]): void {
    this.filtroGestion = selectedValues;
    this.aplicarFiltros();
  }

  onCarreraSelectionChange(selectedValues: string[]): void {
    this.filtroCarrera = selectedValues;
    this.aplicarFiltros();
  }

  onDescuentoSelectionChange(selectedValues: string[]): void {
    this.filtroDescuento = selectedValues;
    this.aplicarFiltros();
  }

  onPlanSelectionChange(selectedValues: string[]): void {
    this.filtroPlan = selectedValues;
    this.aplicarFiltros();
  }

  abrirModalEdicion(registro: RegistroConSolicitud): void {
    if (this.isSavingRegistro) {
      return;
    }

    this.editingRegistroId = registro.id;
    this.registroEnEdicion = registro;
    this.editForm = {
      comentarios: registro.comentarios ?? '',
      registrado: !!registro.registrado
    };
    this.showEditModal = true;
  }

  cerrarModalEdicion(): void {
    this.showEditModal = false;
    this.editingRegistroId = null;
    this.registroEnEdicion = null;
    this.editForm = {
      comentarios: '',
      registrado: false
    };
    this.isSavingRegistro = false;
  }

  async guardarEdicion(): Promise<void> {
    const registro = this.registroEnEdicion;

    if (!registro?.id) {
      this.toastService.error('Registro inválido', 'No se pudo identificar el registro a actualizar');
      return;
    }

    if (!window.academicoAPI?.updateRegistroEstudiante) {
      this.toastService.error('Funcionalidad no disponible', 'La API de actualización no está accesible en este momento');
      return;
    }

    const comentariosFormateados = this.editForm.comentarios?.trim() ?? '';

    if (comentariosFormateados.length > 500) {
      this.toastService.warning('Comentarios muy extensos', 'Reduce el mensaje a un máximo de 500 caracteres antes de guardar.');
      return;
    }

    this.isSavingRegistro = true;

    try {
      const payload = {
        comentarios: comentariosFormateados || null,
        registrado: this.editForm.registrado
      };

      await window.academicoAPI.updateRegistroEstudiante(registro.id, payload);

      this.actualizarRegistroLocal(registro.id, {
        comentarios: payload.comentarios ?? undefined,
        registrado: payload.registrado
      });

      this.toastService.success('Registro actualizado', 'Los cambios se guardaron correctamente', 3000);
      this.cerrarModalEdicion();
    } catch (error) {
      console.error('❌ Error actualizando registro:', error);
      this.toastService.error('Error al guardar', 'No se pudieron guardar los cambios. Intente nuevamente.');
      this.isSavingRegistro = false;
    }
  }

  private actualizarRegistroLocal(registroId: string, cambios: Partial<RegistroEstudiante>): void {
    const actualizarColeccion = (coleccion: SolicitudAgrupada[]) => {
      coleccion.forEach(grupo => {
        grupo.registros.forEach(item => {
          if (item.id === registroId) {
            Object.assign(item, cambios);
          }
        });
        grupo.registros = this.ordenarRegistrosPorDescuento(grupo.registros);
      });
    };

    actualizarColeccion(this.solicitudesAgrupadas);
    actualizarColeccion(this.solicitudesOriginales);

    if (this.selectedSolicitud) {
      this.selectedSolicitud.registros.forEach(item => {
        if (item.id === registroId) {
          Object.assign(item, cambios);
        }
      });
      this.selectedSolicitud.registros = this.ordenarRegistrosPorDescuento(this.selectedSolicitud.registros);
    }

    if (Object.prototype.hasOwnProperty.call(cambios, 'comentarios')) {
      this.sincronizarEstadoComentario(registroId, cambios.comentarios ?? null);
    }
  }

  private sincronizarEstadoComentario(registroId: string, comentario?: string | null): void {
    const texto = (comentario ?? '').trim();
    if (!texto || texto.length <= this.COMMENT_PREVIEW_LIMIT) {
      this.comentariosExpandido.delete(registroId);
    }
  }

  // Métodos para vista detallada
  openDetailModal(solicitudAgrupada: SolicitudAgrupada): void {
    this.selectedSolicitud = { ...solicitudAgrupada };
    this.showDetailModal = true;
    this.expandedDetailItems.clear();
    // Por defecto expandir todos los items para vista detallada
    solicitudAgrupada.registros.forEach((_, index) => {
      this.expandedDetailItems.add(index);
    });
  }

  closeDetailModal(): void {
    this.showDetailModal = false;
    this.selectedSolicitud = null;
    this.expandedDetailItems.clear();
  }

  toggleDetailAccordion(index: number): void {
    if (this.expandedDetailItems.has(index)) {
      this.expandedDetailItems.delete(index);
    } else {
      this.expandedDetailItems.add(index);
    }
  }

  isDetailExpanded(index: number): boolean {
    return this.expandedDetailItems.has(index);
  }

  // Helper methods para vista detallada
  getStudentsWithDiscountInDetail(): number {
    if (!this.selectedSolicitud) return 0;
    return this.selectedSolicitud.registros.filter(r => (r.porcentaje_descuento || 0) > 0).length;
  }

  // Métodos de exportación para vista detallada
  exportarDetalleExcel(): void {
    if (!this.selectedSolicitud) {
      this.toastService.warning('Sin Datos', 'No hay datos seleccionados para exportar');
      return;
    }

    this.isExportingDetail = true;

    try {
      setTimeout(() => {
        const registros = this.selectedSolicitud!.registros;
        
        // Crear datos para Excel
        const datosExcel = registros.map(registro => ({
          'CI Estudiante': registro.ci_estudiante || '',
          'Nombre Completo': registro.nombre_estudiante || '',
          'Carrera': registro.carrera || '',
          'Total U.V.E.': registro.total_creditos || 0,
          'Valor U.V.E.': registro.valor_credito || 0,
          'Crédito Tecnológico': registro.credito_tecnologico || 0,
          'Descuento (%)': registro.porcentaje_descuento ? (registro.porcentaje_descuento * 100).toFixed(1) + '%' : '0%',
          'Plan de Pago': registro.plan_primer_pago || '',
          'Monto Primer Pago': registro.monto_primer_pago || 0,
          'Referencia': registro.referencia_primer_pago || '',
          'Total Semestre': registro.total_semestre || 0,
          'Registrado': registro.registrado ? 'Sí' : 'No'
        }));

        // Crear libro de trabajo
        const libro = XLSX.utils.book_new();
        const hoja = XLSX.utils.json_to_sheet(datosExcel);

        // Configurar anchos de columnas
        hoja['!cols'] = [
          { wch: 18 }, // CI
          { wch: 35 }, // Nombre
          { wch: 30 }, // Carrera
          { wch: 15 }, // UVE
          { wch: 15 }, // Valor UVE
          { wch: 20 }, // Crédito Tec
          { wch: 15 }, // Descuento
          { wch: 20 }, // Plan
          { wch: 18 }, // Monto
          { wch: 30 }, // Referencia
          { wch: 18 }, // Total
          { wch: 12 }  // Registrado
        ];

        XLSX.utils.book_append_sheet(libro, hoja, 'Detalle Solicitud');

        // Generar nombre de archivo
        const fecha = new Date();
        const fechaFormateada = this.formatDateForFile(fecha);
        const solicitudId = this.selectedSolicitud!.solicitud.id?.slice(-8) || 'solicitud';
        const nombreArchivo = `detalle_solicitud_${solicitudId}_${fechaFormateada}.xlsx`;

        XLSX.writeFile(libro, nombreArchivo);

        this.isExportingDetail = false;
        this.toastService.success(
          'Exportación Exitosa',
          `Archivo "${nombreArchivo}" descargado con ${registros.length} registros`,
          3000
        );
      }, 1500);
    } catch (error) {
      this.isExportingDetail = false;
      this.toastService.error(
        'Error de Exportación',
        'Error al generar el archivo Excel'
      );
    }
  }

  exportarDetallePDF(): void {
    if (!this.selectedSolicitud) {
      this.toastService.warning('Sin Datos', 'No hay datos seleccionados para exportar');
      return;
    }

    this.isGeneratingPDFDetail = true;

    try {
      setTimeout(() => {
        this.generateDetailPDFDocument();
        this.isGeneratingPDFDetail = false;
        this.toastService.success(
          'PDF Generado',
          'Archivo PDF descargado exitosamente',
          3000
        );
      }, 2000);
    } catch (error) {
      this.isGeneratingPDFDetail = false;
      this.toastService.error(
        'Error en PDF',
        'Error al generar el archivo PDF'
      );
    }
  }

  private generateDetailPDFDocument(): void {
    const doc = new jsPDF('l', 'mm', 'a4');
    const pageWidth = doc.internal.pageSize.width;
    const margin = 15;
    
    // Encabezado
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(18);
    doc.text('DETALLE DE SOLICITUD - APOYO FAMILIAR', pageWidth / 2, 20, { align: 'center' });
    
    doc.setFontSize(12);
    doc.setFont('helvetica', 'normal');
    const solicitudInfo = this.selectedSolicitud!.solicitud;
    const fecha = new Date().toLocaleDateString('es-ES');
    doc.text(`ID Solicitud: ${solicitudInfo.id?.slice(-12) || 'N/A'}`, margin, 35);
    doc.text(`Fecha de generación: ${fecha}`, pageWidth - margin, 35, { align: 'right' });
    doc.text(`Gestión: ${this.getNombreGestion(solicitudInfo.id_gestion)}`, margin, 42);
    doc.text(`Total estudiantes: ${this.selectedSolicitud!.registros.length}`, pageWidth - margin, 42, { align: 'right' });

    // Línea separadora
    doc.setLineWidth(0.5);
    doc.line(margin, 48, pageWidth - margin, 48);

    let currentY = 60;
    
    // Procesar cada estudiante
    this.selectedSolicitud!.registros.forEach((registro, index) => {
      if (currentY > 180) { // Nueva página si es necesario
        doc.addPage();
        currentY = 20;
      }
      
      currentY = this.addDetailStudentSection(doc, registro, currentY, pageWidth, margin, index + 1);
      currentY += 10;
    });

    // Generar y descargar
    const solicitudId = solicitudInfo.id?.slice(-8) || 'solicitud';
    const fechaFormateada = this.formatDateForFile(new Date());
    const nombreArchivo = `detalle_solicitud_${solicitudId}_${fechaFormateada}.pdf`;
    
    doc.save(nombreArchivo);
  }

  private addDetailStudentSection(doc: jsPDF, registro: RegistroConSolicitud, startY: number, pageWidth: number, margin: number, numeroEstudiante: number): number {
    let currentY = startY;
    
    // Información del estudiante
    doc.setFillColor(240, 248, 255);
    doc.rect(margin, currentY, pageWidth - 2 * margin, 20, 'F');
    doc.setDrawColor(59, 130, 246);
    doc.rect(margin, currentY, pageWidth - 2 * margin, 20);
    
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(30, 58, 138);
    doc.text(`ESTUDIANTE ${numeroEstudiante}`, margin + 5, currentY + 8);
    
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(0, 0, 0);
    
    const col1X = margin + 5;
    const col2X = pageWidth / 2;
    
    doc.text(`CI: ${registro.ci_estudiante}`, col1X, currentY + 14);
    doc.text(`Nombre: ${registro.nombre_estudiante}`, col2X, currentY + 14);
    doc.text(`U.V.E.: ${registro.total_creditos}`, col1X, currentY + 18);
    doc.text(`Carrera: ${registro.carrera}`, col2X, currentY + 18);
    
    return currentY + 25;
  }

  private formatDateForFile(date: Date): string {
    const day = date.getDate().toString().padStart(2, '0');
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const year = date.getFullYear();
    return `${day}-${month}-${year}`;
  }

  private normalizarPlan(plan?: string | null): string {
    return (plan || '').toLowerCase().trim();
  }

  private coincidePlanFiltro(plan?: string | null): boolean {
    const normalizado = this.normalizarPlan(plan);
    if (!normalizado) {
      return false;
    }

    return this.filtroPlan.some(valor => this.normalizarPlan(valor) === normalizado);
  }

  // --- Exportación global ---

  private obtenerTodasLasFilasFiltradas(): RegistroConSolicitud[] {
    const registros: RegistroConSolicitud[] = [];
    this.solicitudesFiltradasTotales.forEach(grupo => {
      registros.push(...grupo.registros);
    });
    return registros;
  }

  hayDatosFiltrados(): boolean {
    return this.solicitudesFiltradasTotales.length > 0;
  }

  exportarListadoExcel(): void {
    if (this.isExportingListadoExcel) {
      return;
    }

    if (!this.hayDatosFiltrados()) {
      this.toastService.warning('Sin datos', 'Aplica filtros con resultados antes de exportar.');
      return;
    }

    this.exportConfigListado = this.crearConfigExportacionPorDefecto();
    this.showListadoExportModal = true;
  }

  cerrarModalExportListado(): void {
    this.showListadoExportModal = false;
  }

  confirmarExportListado(config: ExportConfig): void {
    this.showListadoExportModal = false;
    this.generarExcelListado(config);
  }

  private generarExcelListado(config: ExportConfig): void {
    const columnasActivas = this.obtenerColumnasActivas(config);

    if (columnasActivas.length === 0) {
      this.toastService.warning('Sin columnas', 'Selecciona al menos una columna para exportar.');
      return;
    }

    this.isExportingListadoExcel = true;

    try {
      const libro = XLSX.utils.book_new();

      const resumenDatos = this.obtenerResumenDatos();
      const resumenSheet = XLSX.utils.json_to_sheet(resumenDatos, { header: ['Etiqueta', 'Detalle'] });
      resumenSheet['!cols'] = [{ wch: 28 }, { wch: 80 }];
      XLSX.utils.book_append_sheet(libro, resumenSheet, 'Resumen');

      const filasDetalle = this.obtenerTodasLasFilasFiltradas();
      const detalles = filasDetalle.map(registro => this.mapearRegistroADetalle(registro, columnasActivas));

      const detalleSheet = XLSX.utils.json_to_sheet(detalles);
      detalleSheet['!cols'] = columnasActivas.map(col => ({ wch: this.obtenerAnchoColumna(col.key) }));
      XLSX.utils.book_append_sheet(libro, detalleSheet, 'Detalle estudiantes');

      const baseNombre = config.fileName?.trim() || 'reporte_lista_registros';
      const nombreNormalizado = this.sanitizarNombreArchivo(baseNombre) || 'reporte_lista_registros';
      const nombreArchivo = `${nombreNormalizado}_${this.formatDateForFile(new Date())}.xlsx`;
      XLSX.writeFile(libro, nombreArchivo);

      this.toastService.success('Exportación completada', `Reporte Excel generado (${detalles.length} filas)`);
    } catch (error) {
      console.error('❌ Error exportando Excel listado:', error);
      this.toastService.error('Error de exportación', 'No se pudo generar el archivo Excel.');
    } finally {
      this.isExportingListadoExcel = false;
    }
  }

  private obtenerColumnasActivas(config: ExportConfig): ExportColumn[] {
    return config.columns
      .filter(col => col.enabled && (!col.isCalculated || config.includeCalculatedFields))
      .map(col => ({ ...col }));
  }

  private mapearRegistroADetalle(registro: RegistroConSolicitud, columnas: ExportColumn[]): Record<string, unknown> {
    const fila: Record<string, unknown> = {};
    columnas.forEach(columna => {
      fila[columna.label] = this.obtenerValorColumna(registro, columna.key);
    });
    return fila;
  }

  private obtenerValorColumna(registro: RegistroConSolicitud, key: string): string | number {
    const porcentaje = registro.porcentaje_descuento || 0;
    const valorCredito = registro.valor_credito || 0;
    const totalCreditos = registro.total_creditos || 0;
    const creditoTecnologico = registro.credito_tecnologico || 0;
    const montoPrimerPago = registro.monto_primer_pago || 0;
    const totalSemestre = registro.total_semestre || 0;

    switch (key) {
      case 'gestion':
        return this.getNombreGestion(registro.id_gestion);
      case 'fecha_solicitud':
        return registro.solicitudInfo ? this.formatearFecha(registro.solicitudInfo.fecha) : '';
      case 'id_solicitud':
        return registro.id_solicitud ? registro.id_solicitud.slice(-8) : '';
      case 'ci_estudiante':
        return registro.ci_estudiante || '';
      case 'nombre_estudiante':
        return registro.nombre_estudiante || '';
      case 'carrera':
        return registro.carrera || '';
      case 'total_creditos':
        return totalCreditos;
      case 'valor_credito':
        return valorCredito;
      case 'credito_tecnologico':
        return creditoTecnologico;
      case 'porcentaje_descuento':
        return `${(porcentaje * 100).toFixed(1)}%`;
      case 'monto_primer_pago':
        return montoPrimerPago;
      case 'plan_primer_pago':
        return registro.plan_primer_pago || '';
      case 'referencia_primer_pago':
        return registro.referencia_primer_pago || '';
      case 'total_semestre':
        return totalSemestre;
      case 'registrado':
        return registro.registrado ? 'Sí' : 'No';
      case 'comentarios':
        return registro.comentarios || '';
      case 'derechos_academicos_originales':
        return valorCredito * totalCreditos;
      case 'derechos_academicos_descuento':
        return (valorCredito * totalCreditos) * (1 - porcentaje);
      case 'ahorro_descuento':
        return (valorCredito * totalCreditos) * porcentaje;
      case 'saldo_semestre_original':
        return totalSemestre - montoPrimerPago;
      case 'saldo_semestre_descuento':
        if (porcentaje > 0) {
          const derechosConDescuento = (valorCredito * totalCreditos) * (1 - porcentaje);
          return derechosConDescuento + creditoTecnologico - montoPrimerPago;
        }
        return totalSemestre - montoPrimerPago;
      default:
        const valorGenerico = (registro as unknown as Record<string, unknown>)[key];
        if (typeof valorGenerico === 'number') {
          return valorGenerico;
        }
        if (valorGenerico === null || valorGenerico === undefined) {
          return '';
        }
        return String(valorGenerico);
    }
  }

  private obtenerAnchoColumna(key: string): number {
    const widths: Record<string, number> = {
      gestion: 16,
      fecha_solicitud: 18,
      id_solicitud: 14,
      ci_estudiante: 18,
      nombre_estudiante: 35,
      carrera: 30,
      total_creditos: 15,
      valor_credito: 18,
      credito_tecnologico: 20,
      porcentaje_descuento: 18,
      monto_primer_pago: 20,
      plan_primer_pago: 25,
      referencia_primer_pago: 34,
      total_semestre: 20,
      registrado: 12,
      comentarios: 40,
      derechos_academicos_originales: 26,
      derechos_academicos_descuento: 28,
      ahorro_descuento: 22,
      saldo_semestre_original: 24,
      saldo_semestre_descuento: 26
    };

    return widths[key] ?? 20;
  }

  private sanitizarNombreArchivo(nombre: string): string {
    return nombre
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-zA-Z0-9-_]+/g, '_')
      .replace(/_{2,}/g, '_')
      .replace(/^_|_$/g, '')
      .toLowerCase();
  }

  private crearConfigExportacionPorDefecto(): ExportConfig {
    const columnas: ExportColumn[] = [
      { key: 'gestion', label: 'Gestión', enabled: true },
      { key: 'fecha_solicitud', label: 'Fecha de Solicitud', enabled: true },
      { key: 'id_solicitud', label: 'ID Solicitud', enabled: true },
      { key: 'ci_estudiante', label: 'Carnet de Identidad', enabled: true },
      { key: 'nombre_estudiante', label: 'Nombre Completo', enabled: true },
      { key: 'carrera', label: 'Carrera', enabled: true },
      { key: 'plan_primer_pago', label: 'Plan de Pago', enabled: true },
      { key: 'monto_primer_pago', label: 'Monto Primer Pago', enabled: true },
      { key: 'porcentaje_descuento', label: 'Porcentaje Descuento', enabled: true },
      { key: 'total_creditos', label: 'Total U.V.E.', enabled: true },
      { key: 'valor_credito', label: 'Valor por U.V.E.', enabled: true },
      { key: 'credito_tecnologico', label: 'Crédito Tecnológico', enabled: true },
      { key: 'total_semestre', label: 'Total Semestre', enabled: true },
      { key: 'referencia_primer_pago', label: 'Referencia Primer Pago', enabled: true },
      { key: 'registrado', label: 'Registrado', enabled: true },
      { key: 'comentarios', label: 'Comentarios', enabled: true },
      { key: 'derechos_academicos_originales', label: 'Derechos Académicos Originales', enabled: true, isCalculated: true },
      { key: 'derechos_academicos_descuento', label: 'Derechos Académicos con Descuento', enabled: true, isCalculated: true },
      { key: 'ahorro_descuento', label: 'Ahorro por Descuento', enabled: true, isCalculated: true },
      { key: 'saldo_semestre_original', label: 'Saldo Semestre Original', enabled: true, isCalculated: true },
      { key: 'saldo_semestre_descuento', label: 'Saldo Semestre con Descuento', enabled: true, isCalculated: true }
    ];

    return {
      columns: columnas.map(col => ({ ...col })),
      includeCalculatedFields: true,
      fileName: 'reporte_lista_registros'
    };
  }

  exportarListadoPDF(): void {
    if (this.isGeneratingListadoPDF) {
      return;
    }

    if (!this.hayDatosFiltrados()) {
      this.toastService.warning('Sin datos', 'Aplica filtros con resultados antes de exportar.');
      return;
    }

    this.isGeneratingListadoPDF = true;

    try {
      const doc = new jsPDF('l', 'mm', 'a4');
      const pageWidth = doc.internal.pageSize.width;
      const generatedAt = new Date();
      const tableMarginTop = 36;

      const detalleFilas = this.obtenerDetallesParaExportacion();
      const tableColumnas = [
        { header: 'Gestión', dataKey: 'Gestion' },
        { header: 'Fecha Registro', dataKey: 'FechaSolicitud' },
        { header: 'CI', dataKey: 'CI' },
        { header: 'Estudiante', dataKey: 'NombreEstudiante' },
        { header: 'Carrera', dataKey: 'Carrera' },
        { header: 'Total U.V.E.', dataKey: 'TotalUVE' },
        { header: 'Plan de pago', dataKey: 'PlanPago' },
        { header: '% Desc.', dataKey: 'PorcentajeDescuento' },
        //{ header: 'Monto 1er Pago', dataKey: 'MontoPrimerPago' },
        { header: 'Registrado', dataKey: 'Registrado' }
      ];

      autoTable(doc, {
        head: [tableColumnas.map(col => col.header)],
        body: detalleFilas.map(fila => tableColumnas.map(col => fila[col.dataKey as keyof typeof fila])),
        margin: { top: tableMarginTop, left: 14, right: 14, bottom: 14 },
        styles: { fontSize: 8, cellPadding: 2, lineColor: [226, 232, 240], lineWidth: 0.2 },
        headStyles: { fillColor: [51, 65, 85], textColor: 255, fontStyle: 'bold' },
        alternateRowStyles: { fillColor: [248, 250, 252] },
        didDrawPage: () => {
          this.dibujarEncabezadoPDF(doc, pageWidth, generatedAt);
        }
      });

      const nombreArchivo = `reporte_lista_registros_${this.formatDateForFile(new Date())}.pdf`;
      doc.save(nombreArchivo);
      this.toastService.success('PDF generado', 'Reporte global exportado correctamente.', 3000);
    } catch (error) {
      console.error('❌ Error exportando PDF listado:', error);
      this.toastService.error('Error de exportación', 'No se pudo generar el archivo PDF.');
    } finally {
      this.isGeneratingListadoPDF = false;
    }
  }

  private obtenerDetallesParaExportacion() {
    const filas = this.obtenerTodasLasFilasFiltradas();
    return filas.map(registro => ({
      Gestion: this.getNombreGestion(registro.id_gestion),
      FechaSolicitud: registro.solicitudInfo ? this.formatearFecha(registro.solicitudInfo.fecha) : '',
      IdSolicitud: registro.id_solicitud ? registro.id_solicitud.slice(-8) : '',
      CI: registro.ci_estudiante,
      NombreEstudiante: registro.nombre_estudiante,
      Carrera: registro.carrera,
      PlanPago: registro.plan_primer_pago || 'No definido',
      PorcentajeDescuento: `${((registro.porcentaje_descuento || 0) * 100).toFixed(1)}%`,
      ValorUVE: registro.valor_credito,
      TotalUVE: registro.total_creditos,
      MontoPrimerPago: registro.monto_primer_pago,
      Registrado: registro.registrado ? 'Sí' : 'No',
      Comentarios: registro.comentarios || ''
    }));
  }

  private obtenerResumenDatos(): Array<{ Etiqueta: string; Detalle: string }> {
    const totalSolicitudes = this.solicitudesFiltradasTotales.length;
    const totalEstudiantes = this.obtenerTodasLasFilasFiltradas().length;
    const totalRegistrados = this.obtenerTodasLasFilasFiltradas().filter(r => r.registrado).length;

    return [
      { Etiqueta: 'Total de solicitudes', Detalle: totalSolicitudes.toString() },
      { Etiqueta: 'Total de estudiantes', Detalle: totalEstudiantes.toString() },
      { Etiqueta: 'Estudiantes registrados', Detalle: totalRegistrados.toString() }
    ];
  }

  private dibujarEncabezadoPDF(doc: jsPDF, pageWidth: number, generatedAt: Date): void {
    const headerHeight = 24;
    doc.setFillColor(255, 255, 255);
    doc.rect(0, 0, pageWidth, headerHeight, 'F');

    const img = new Image();
    img.src = "logo-ucb-cba.png"; 
    // Logo
    const logoWidth = 35; // mm
    const logoHeight = 22; // mm (proporción aproximada)
    const logoX = 12; // un poco a la derecha del borde
    const logoY = 3; // centrado verticalmente dentro del rectángulo
    try {
      doc.addImage(img, 'PNG', logoX, logoY, logoWidth, logoHeight);
    } catch {
      // continuar aunque falle el logo
    }

    // Posicionar textos desplazados a la derecha del logo
    const textStartX = logoX + logoWidth + 8; // margen después del logo
    const centerOffset = (textStartX + (pageWidth - 16)) / 2; // equilibrio visual

    doc.setTextColor(0, 0, 0);
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.text('REPORTE GENERAL - APOYO FAMILIAR', centerOffset, 14, { align: 'center' });

    doc.setFontSize(11);
    doc.setFont('helvetica', 'normal');
    doc.text('Servicio Académico Administrativo Estudiantil', centerOffset, 20, { align: 'center' });

    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.text(`Generado: ${generatedAt.toLocaleString('es-BO')}`, pageWidth - 16, 22, { align: 'right' });
  }

  private ordenarRegistrosPorDescuento<T extends RegistroConSolicitud>(registros: T[]): T[] {
    return [...registros].sort((a, b) => {
      const descuentoA = a.porcentaje_descuento ?? 0;
      const descuentoB = b.porcentaje_descuento ?? 0;

      if (descuentoA !== descuentoB) {
        return descuentoA - descuentoB;
      }

      return a.nombre_estudiante.localeCompare(b.nombre_estudiante);
    });
  }

  estaComentarioExpandido(registroId?: string | null): boolean {
    if (!registroId) {
      return false;
    }
    return this.comentariosExpandido.has(registroId);
  }

  esComentarioLargo(registro: RegistroConSolicitud): boolean {
    return (registro.comentarios?.trim().length || 0) > this.COMMENT_PREVIEW_LIMIT;
  }

  obtenerComentarioVisible(registro: RegistroConSolicitud): string {
    const texto = (registro.comentarios || '').trim();
    if (!texto) {
      return 'Sin comentarios registrados';
    }

    if (!this.estaComentarioExpandido(registro.id) && texto.length > this.COMMENT_PREVIEW_LIMIT) {
      return texto.slice(0, this.COMMENT_PREVIEW_LIMIT).trimEnd() + '…';
    }

    return texto;
  }

  toggleComentarioExpandido(registro: RegistroConSolicitud): void {
    const registroId = registro.id;
    if (!registroId) {
      return;
    }

    if (this.comentariosExpandido.has(registroId)) {
      this.comentariosExpandido.delete(registroId);
    } else {
      this.comentariosExpandido.add(registroId);
    }
  }
}