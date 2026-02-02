import { Component, OnInit, OnDestroy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule, Router } from '@angular/router';
import { RegistroEstudiante } from '../../../interfaces/registro-estudiante';
import { Gestion } from '../../../interfaces/gestion';
import { Carrera } from '../../../interfaces/carrera';
import { Solicitud } from '../../../interfaces/solicitud';
import { ApoyoFamiliar } from '../../../interfaces/apoyo-familiar';
import { Beneficio } from '../../../interfaces/beneficio';
import { ToastService } from '../../../../shared/servicios/toast';
import { ToastContainerComponent } from '../../../../shared/componentes/toast-container/toast-container';
import { MultiSelectDropdownComponent, MultiSelectOption } from '../../../../shared/componentes/multi-select-dropdown/multi-select-dropdown';
import { StudentAccordionComponent } from '../shared/student-accordion/student-accordion';
import { ExportActionsComponent } from '../shared/export-actions/export-actions';
import { ExportConfigModalComponent } from '../shared/export-config-modal/export-config-modal';
import { CarreraService } from '../../../servicios/carrera.service';
import { GestionService } from '../../../servicios/gestion.service';
import { BeneficioService } from '../../../servicios/beneficio.service';
import { ExportService } from '../../../servicios/export.service';
import { Subject, takeUntil, debounceTime, distinctUntilChanged } from 'rxjs';
import * as XLSX from 'xlsx';
import '../../../../shared/interfaces/electron-api';
import { ExportConfig, ExportColumn } from '../../../../shared/interfaces/export-config';
// Logo institucional centralizado reutilizado para encabezados de reportes PDF
import { DriverService } from '../../../../shared/servicios/driver';
import { AcademicoUtilsService } from '../../../servicios/academico-utils.service';

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
  imports: [
    CommonModule,
    FormsModule,
    RouterModule,
    ToastContainerComponent,
    MultiSelectDropdownComponent,
    StudentAccordionComponent,
    ExportActionsComponent,
    ExportConfigModalComponent
  ],
  templateUrl: './lista-registros.html',
  styleUrl: './lista-registros.scss'
})
export class ListaRegistrosComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();
  private readonly COMMENT_PREVIEW_LIMIT = 100;
  private academicoUtils = inject(AcademicoUtilsService);

  // Datos principales
  registrosEstudiantes: RegistroEstudiante[] = [];
  solicitudesAgrupadas: SolicitudAgrupada[] = [];
  solicitudesOriginales: SolicitudAgrupada[] = [];
  solicitudesFiltradasTotales: SolicitudAgrupada[] = [];
  gestiones: Gestion[] = [];
  carreras: Carrera[] = [];
  solicitudes: Solicitud[] = [];
  apoyosFamiliares: ApoyoFamiliar[] = [];
  beneficios: Beneficio[] = [];

  //Servicios
  carreraService = inject(CarreraService);
  gestionService = inject(GestionService);
  beneficioService = inject(BeneficioService);
  exportService = inject(ExportService);
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
  filtroDescuentoMin: number = 0;
  filtroDescuentoMax: number = 100;
  filtroPlan: string[] = [];
  filtroBeneficio: string[] = [];
  filtroEstadoPago: string[] = [];
  filtroEstadoRegistro: string[] = [];

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
    registrado: false,
    porcentaje_descuento: 0
  };
  isSavingRegistro = false;
  showEditModal = false;

  // Modal de confirmación de eliminación
  showDeleteModal = false;
  solicitudAEliminar: SolicitudAgrupada | null = null;
  isDeletingRegistros = false;
  comentariosExpandido = new Set<string>();
  isExportingListadoExcel = false;
  isGeneratingListadoPDF = false;
  showListadoExportModal = false;
  exportConfigListado: ExportConfig = { columns: [], includeCalculatedFields: true, fileName: 'lista_registros' };

  // Dropdown options
  gestionOptions: MultiSelectOption[] = [];
  carreraOptions: MultiSelectOption[] = [];
  planOptions: MultiSelectOption[] = [];
  beneficioOptions: MultiSelectOption[] = [];
  estadoPagoOptions: MultiSelectOption[] = [];
  estadoRegistroOptions: MultiSelectOption[] = [];

  // Acciones masivas
  showBulkActionsMenu = false;
  isPerformingBulkAction = false;
  showBulkConfirmModal = false;
  bulkActionType: 'registrado' | 'pendiente' | 'actualizar_datos' | null = null;

  // Paginación
  currentPage = 1;
  itemsPerPage = 10;
  totalItems = 0;

  steps = [
    {
      element: '#filtros',
      popover: { title: 'Panel de filtros', description: 'Mediante este panel, se puede realizar un filtrado de los registros de estudiantes del apoyo familiar.' }
    },
    {
      element: '#filtro-gestion',
      popover: { title: 'Filtro por gestión', description: 'Permite filtrar los registros por una o más gestiones académicas.' }
    },
    {
      element: '#filtro-carrera',
      popover: { title: 'Filtro por carrera', description: 'Permite filtrar los registros por una o más carreras a las que pertenece el estudiante.' }
    },
    {
      element: '#filtro-descuento',
      popover: { title: 'Filtro por rango de descuento', description: 'Permite filtrar los registros según un rango de porcentaje de descuento, desde un mínimo hasta un máximo.' }
    },
    {
      element: '#filtro-plan',
      popover: { title: 'Filtro por plan de pago', description: 'Permite filtrar los registros según si han realizado el Plan Estandar o el Plan Plus.' }
    },
    {
      element: '#filtro-estudiante',
      popover: { title: 'Filtro por nombre o carnet', description: 'Permite filtrar los registros según el nombre o carnet del estudiante.' }
    },
    {
      element: '#agrupar',
      popover: { title: 'Agrupar o no estudiantes', description: 'En el caso de marcar con un check, solo se mostrarán los estudiantes que cumplan con el filtro. Caso contrario, se mostrará junto con su/s hermano/s.' }
    },
    {
      element: '#exportar',
      popover: { title: 'Exportar datos', description: 'Permite exportar los datos filtrados a formato XLSX o PDF.' }
    },
    {
      element: '#detalle',
      popover: { title: 'Detalles de la solicitud', description: 'Permite ver detalles de como quedaría el plan de pagos de ambos estudiantes. Además se permite exportar esta información a Excel o PDF.' }
    },
    {
      element: '#editar',
      popover: { title: 'Editar registro', description: 'Permite editar campos como si el estudiante ha sido registrado o añadir comentarios.' }
    }
  ];

  constructor(private toastService: ToastService, private router: Router, private driverService: DriverService) {}

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

  mostrarTutorial(){
    this.driverService.startTour(this.steps);
  }

  async cargarDatos(): Promise<void> {
    try {
      this.isLoading = true;

      // Verificar APIs disponibles
      if (!window.academicoAPI?.getAllRegistroEstudianteActivos || !window.academicoAPI?.getAllSolicitud) {
        throw new Error('APIs de base de datos no disponibles');
      }

      // Cargar TODOS los registros (no solo apoyo familiar) y solicitudes
      const [registros, solicitudes] = await Promise.all([
        window.academicoAPI.getAllRegistroEstudianteActivos(),
        window.academicoAPI.getAllSolicitud()
      ]);

      this.registrosEstudiantes = registros || [];
      this.registrosEstudiantes.map(r => {
        r.carrera = this.carreraService.getCarreraById(r.id_carrera || '')?.carrera || r.carrera;
      });
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

      // Cargar apoyos familiares y beneficios desde la API
      if (window.academicoAPI) {
        this.apoyosFamiliares = await window.academicoAPI.getAllApoyoFamiliar();
      }
      
      // Cargar beneficios desde el servicio
      this.beneficios = this.beneficioService.currentData || [];

      // Create dropdown options
      this.gestionOptions = this.gestiones.map(gestion => ({
        value: gestion.id,
        label: gestion.gestion
      }));

      this.carreraOptions = this.carreras.map(carrera => ({
        value: carrera.id, // Usar ID para filtros
        label: carrera.carrera // Mostrar nombre en UI
      }));

      this.planOptions = [
        { value: 'Plan Estandar', label: 'Plan Estandar' },
        { value: 'Plan Plus', label: 'Plan Plus' }
      ];

      this.beneficioOptions = this.beneficios.map(beneficio => ({
        value: beneficio.id,
        label: beneficio.nombre
      }));

      this.estadoPagoOptions = [
        { value: 'con_deuda', label: 'Estudiantes con Deuda' },
        { value: 'sin_deuda', label: 'Estudiantes sin Deuda' },
        { value: 'saldo_a_favor', label: 'Estudiantes con Saldo a Favor' },
        { value: 'sin_pago_cuota', label: 'Estudiantes sin Pago de Cuota' },
        { value: 'con_pago_cuota', label: 'Estudiantes con Pago de Cuota' }
      ];

      this.estadoRegistroOptions = [
        { value: 'registrado', label: 'Registrado' },
        { value: 'pendiente', label: 'Pendiente' }
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

    // Agrupar registros
    const gruposMap = new Map<string, RegistroEstudiante[]>();

    this.registrosEstudiantes.forEach(registro => {
      // Si tiene id_solicitud (apoyo familiar), agrupar por solicitud
      // Si NO tiene id_solicitud (otros beneficios), crear grupo individual con ID del registro
      const grupoId = registro.id_solicitud || `individual-${registro.id}`;
      
      if (!gruposMap.has(grupoId)) {
        gruposMap.set(grupoId, []);
      }
      gruposMap.get(grupoId)!.push(registro);
    });

    // Crear solicitudes agrupadas con información combinada
    this.solicitudesAgrupadas = Array.from(gruposMap.entries()).map(([grupoId, registros]) => {
      // Si el grupoId empieza con "individual-", es un beneficio individual
      const esIndividual = grupoId.startsWith('individual-');
      
      let solicitud: Solicitud;
      
      if (esIndividual) {
        // Crear solicitud "virtual" para beneficios individuales
        const registro = registros[0];
        solicitud = {
          id: grupoId,
          fecha: registro.created_at || new Date().toISOString(),
          id_gestion: registro.id_gestion || '',
          estado: 'completado',
          cantidad_estudiantes: 1,
          comentarios: 'Beneficio individual'
        };
      } else {
        // Usar solicitud real de la base de datos
        solicitud = solicitudesMap.get(grupoId) || {
          id: grupoId,
          fecha: new Date().toISOString(),
          id_gestion: registros[0]?.id_gestion || '',
          estado: 'desconocido',
          cantidad_estudiantes: registros.length,
          comentarios: 'Solicitud no encontrada'
        };
      }

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

    // Filtro por carrera (multi-select) - usar id_carrera
    if (this.filtroCarrera.length > 0) {
      solicitudesFiltradas = solicitudesFiltradas.filter(item =>
        item.registros.some((registro: RegistroConSolicitud) =>
          registro.id_carrera && this.filtroCarrera.includes(registro.id_carrera)
        )
      );
    }

    // Filtro por descuento de apoyo familiar (rango)
    if (this.filtroDescuentoMin > 0 || this.filtroDescuentoMax < 100) {
      solicitudesFiltradas = solicitudesFiltradas.filter(item =>
        item.registros.some((registro: RegistroConSolicitud) => {
          const descuentoPorcentaje = registro.porcentaje_descuento * 100;
          return descuentoPorcentaje >= this.filtroDescuentoMin && descuentoPorcentaje <= this.filtroDescuentoMax;
        })
      );
    }

    // Filtro por tipo de beneficio (multi-select)
    if (this.filtroBeneficio.length > 0) {
      solicitudesFiltradas = solicitudesFiltradas.filter(item =>
        item.registros.some((registro: RegistroConSolicitud) =>
          registro.id_beneficio && this.filtroBeneficio.includes(registro.id_beneficio)
        )
      );
    }

    if (this.filtroPlan.length > 0) {
      solicitudesFiltradas = solicitudesFiltradas.filter(item =>
        item.registros.some(registro => this.coincidePlanFiltro(registro.plan_primer_pago))
      );
    }

    // Filtro por estado de pago (multi-select)
    if (this.filtroEstadoPago.length > 0) {
      solicitudesFiltradas = solicitudesFiltradas.filter(item =>
        item.registros.some((registro: RegistroConSolicitud) =>
          this.filtroEstadoPago.some(estado => this.cumpleEstadoPago(registro, estado))
        )
      );
    }

    // Filtro por estado de registro (multi-select)
    if (this.filtroEstadoRegistro.length > 0) {
      solicitudesFiltradas = solicitudesFiltradas.filter(item =>
        item.registros.some((registro: RegistroConSolicitud) =>
          this.filtroEstadoRegistro.some(estado => {
            if (estado === 'registrado') {
              return registro.registrado === true;
            } else if (estado === 'pendiente') {
              return registro.registrado === false;
            }
            return false;
          })
        )
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

      // Filtro por carrera - usar id_carrera
      if (this.filtroCarrera.length > 0) {
        registrosFiltrados = registrosFiltrados.filter((registro: RegistroConSolicitud) =>
          registro.id_carrera && this.filtroCarrera.includes(registro.id_carrera)
        );
      }

      // Filtro por descuento (rango)
      if (this.filtroDescuentoMin > 0 || this.filtroDescuentoMax < 100) {
        registrosFiltrados = registrosFiltrados.filter((registro: RegistroConSolicitud) => {
          const descuentoPorcentaje = registro.porcentaje_descuento * 100;
          return descuentoPorcentaje >= this.filtroDescuentoMin && descuentoPorcentaje <= this.filtroDescuentoMax;
        });
      }

      // Filtro por tipo de beneficio
      if (this.filtroBeneficio.length > 0) {
        registrosFiltrados = registrosFiltrados.filter((registro: RegistroConSolicitud) =>
          registro.id_beneficio && this.filtroBeneficio.includes(registro.id_beneficio)
        );
      }

      // Filtro por plan de pago
      if (this.filtroPlan.length > 0) {
        registrosFiltrados = registrosFiltrados.filter(registro => this.coincidePlanFiltro(registro.plan_primer_pago));
      }

      // Filtro por estado de pago
      if (this.filtroEstadoPago.length > 0) {
        registrosFiltrados = registrosFiltrados.filter((registro: RegistroConSolicitud) =>
          this.filtroEstadoPago.some(estado => this.cumpleEstadoPago(registro, estado))
        );
      }

      // Filtro por estado de registro
      if (this.filtroEstadoRegistro.length > 0) {
        registrosFiltrados = registrosFiltrados.filter((registro: RegistroConSolicitud) =>
          this.filtroEstadoRegistro.some(estado => {
            if (estado === 'registrado') {
              return registro.registrado === true;
            } else if (estado === 'pendiente') {
              return registro.registrado === false;
            }
            return false;
          })
        );
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
    this.filtroDescuentoMin = 0;
    this.filtroDescuentoMax = 100;
    this.filtroPlan = [];
    this.filtroBeneficio = [];
    this.filtroEstadoPago = [];
    this.filtroEstadoRegistro = [];
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

  toggleCarrera(carreraId: string): void {
    const index = this.filtroCarrera.indexOf(carreraId);
    if (index > -1) {
      this.filtroCarrera.splice(index, 1);
    } else {
      this.filtroCarrera.push(carreraId);
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
      this.filtroCarrera = this.carreras.map(c => c.id); // Usar IDs
    }
    this.onFiltroChange();
  }

  isGestionSelected(gestionId: string): boolean {
    return this.filtroGestion.includes(gestionId);
  }

  isCarreraSelected(carreraId: string): boolean {
    return this.filtroCarrera.includes(carreraId);
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
      // Buscar el nombre de la carrera por su ID
      const carrera = this.carreras.find(c => c.id === this.filtroCarrera[0]);
      return carrera?.carrera || 'Carrera seleccionada';
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

  onDescuentoRangeChange(): void {
    this.aplicarFiltros();
  }

  onPlanSelectionChange(selectedValues: string[]): void {
    this.filtroPlan = selectedValues;
    this.aplicarFiltros();
  }

  onBeneficioSelectionChange(selectedValues: string[]): void {
    this.filtroBeneficio = selectedValues;
    this.aplicarFiltros();
  }

  onEstadoPagoSelectionChange(selectedValues: string[]): void {
    this.filtroEstadoPago = selectedValues;
    this.aplicarFiltros();
  }

  onEstadoRegistroSelectionChange(selectedValues: string[]): void {
    this.filtroEstadoRegistro = selectedValues;
    this.aplicarFiltros();
  }

  // Método para obtener nombre del beneficio por ID
  getNombreBeneficio(idBeneficio?: string): string {
    if (!idBeneficio) return 'N/A';
    const beneficio = this.beneficios.find(b => b.id === idBeneficio);
    return beneficio?.nombre || 'Desconocido';
  }

  // Método para verificar si un beneficio es "Apoyo Familiar"
  esApoyoFamiliar(idBeneficio?: string): boolean {
    if (!idBeneficio) return false;
    const beneficio = this.beneficios.find(b => b.id === idBeneficio);
    return beneficio?.nombre?.toLowerCase().includes('apoyo familiar') ?? false;
  }

  // Método para verificar si el porcentaje es editable
  esPorcentajeEditable(idBeneficio?: string): boolean {
    if (!idBeneficio) return false;
    
    const beneficio = this.beneficios.find(b => b.id === idBeneficio);
    if (!beneficio) return false;
    
    // No es editable si es Apoyo Familiar
    if (beneficio.nombre?.toLowerCase().includes('apoyo familiar')) {
      return false;
    }
    
    // No es editable si el beneficio tiene un porcentaje predeterminado
    if (beneficio.porcentaje !== undefined && beneficio.porcentaje !== null) {
      return false;
    }
    
    return true;
  }

  // Método para obtener el motivo de no edición
  getMotivoNoEditable(idBeneficio?: string): string {
    if (!idBeneficio) return 'Beneficio no especificado';
    
    const beneficio = this.beneficios.find(b => b.id === idBeneficio);
    if (!beneficio) return 'Beneficio no encontrado';
    
    if (beneficio.nombre?.toLowerCase().includes('apoyo familiar')) {
      return 'El descuento no puede editarse para beneficios de Apoyo Familiar.';
    }
    
    if (beneficio.porcentaje !== undefined && beneficio.porcentaje !== null) {
      return `Este beneficio tiene un porcentaje predeterminado de ${(beneficio.porcentaje * 100).toFixed(0)}% que no puede modificarse.`;
    }
    
    return 'El porcentaje no puede editarse para este beneficio.';
  }

  abrirModalEdicion(registro: RegistroConSolicitud): void {
    if (this.isSavingRegistro) {
      return;
    }

    this.editingRegistroId = registro.id;
    this.registroEnEdicion = registro;
    this.editForm = {
      comentarios: registro.comentarios ?? '',
      registrado: !!registro.registrado,
      porcentaje_descuento: (registro.porcentaje_descuento ?? 0) * 100 // Convertir a porcentaje
    };
    this.showEditModal = true;
  }

  cerrarModalEdicion(): void {
    this.showEditModal = false;
    this.editingRegistroId = null;
    this.registroEnEdicion = null;
    this.editForm = {
      comentarios: '',
      registrado: false,
      porcentaje_descuento: 0
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

    // Validar porcentaje de descuento
    const porcentajeDescuento = this.editForm.porcentaje_descuento;
    if (porcentajeDescuento < 0 || porcentajeDescuento > 100) {
      this.toastService.warning('Porcentaje inválido', 'El porcentaje de descuento debe estar entre 0 y 100.');
      return;
    }

    this.isSavingRegistro = true;

    try {
      const payload: any = {
        comentarios: comentariosFormateados || null,
        registrado: this.editForm.registrado
      };

      // Solo incluir porcentaje_descuento si es editable
      const esEditable = this.esPorcentajeEditable(registro.id_beneficio);
      if (esEditable) {
        payload.porcentaje_descuento = porcentajeDescuento / 100; // Convertir a decimal
      }

      await window.academicoAPI.updateRegistroEstudiante(registro.id, payload);

      const cambiosLocales: Partial<RegistroEstudiante> = {
        comentarios: payload.comentarios ?? undefined,
        registrado: payload.registrado
      };

      // Actualizar porcentaje localmente si se modificó
      if (esEditable) {
        cambiosLocales.porcentaje_descuento = payload.porcentaje_descuento;
      }

      this.actualizarRegistroLocal(registro.id, cambiosLocales);

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

  obtenerTotalConDescuento(registro: RegistroEstudiante): number {
    const beneficio = this.beneficios.find(b => b.id === registro.id_beneficio);
    registro.creditos_descuento = beneficio?.limite_creditos ? registro.total_creditos > beneficio?.limite_creditos ? beneficio.limite_creditos : registro.total_creditos : registro.total_creditos;
    const derechosAcademicosConDescuento = registro.creditos_descuento! * (registro.valor_credito || 0) * (1 - (registro.porcentaje_descuento || 0)) + (registro.valor_credito || 0) * (registro.total_creditos! - registro.creditos_descuento!);
    return derechosAcademicosConDescuento + (registro.credito_tecnologico || 0);
  }
  obtenerSaldoConDescuento(registro: RegistroEstudiante): number {
    const totalConDescuento = this.obtenerTotalConDescuento(registro);
    const saldoConDescuento = totalConDescuento - (registro.monto_primer_pago || 0) - (registro.pagos_realizados || 0) - (registro.pago_credito_tecnologico ? registro.credito_tecnologico! : 0);
    return saldoConDescuento;
  }
  // Métodos para vista detallada
  openDetailModal(solicitudAgrupada: SolicitudAgrupada): void {
    for (const registro of solicitudAgrupada.registros) {
      const beneficio = this.beneficios.find(b => b.id === registro.id_beneficio);
      registro.creditos_descuento = beneficio?.limite_creditos ? registro.total_creditos > beneficio?.limite_creditos ? beneficio.limite_creditos : registro.total_creditos : registro.total_creditos;
    }
    this.selectedSolicitud = { ...solicitudAgrupada };
    this.showDetailModal = true;
    this.expandedDetailItems.clear();
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

  async exportarDetallePDF(): Promise<void> {
    if (!this.selectedSolicitud) {
      this.toastService.warning('Sin Datos', 'No hay datos seleccionados para exportar');
      return;
    }

    this.isGeneratingPDFDetail = true;

    try {
      const solicitudInfo = this.selectedSolicitud.solicitud;
      const gestionNombre = this.getNombreGestion(solicitudInfo.id_gestion);
      
      const success = await this.exportService.exportDetailToPDF(
        this.selectedSolicitud.registros,
        solicitudInfo.id || '',
        gestionNombre,
        (id) => this.getNombreGestion(id),
        (fecha) => this.formatearFecha(fecha)
      );
      
      if (!success) {
        this.toastService.error('Error en PDF', 'Error al generar el archivo PDF');
      }
    } catch (error) {
      console.error('❌ Error exportando PDF de detalle:', error);
      this.toastService.error('Error en PDF', 'Error al generar el archivo PDF');
    } finally {
      this.isGeneratingPDFDetail = false;
    }
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

  private cumpleEstadoPago(registro: RegistroConSolicitud, estado: string): boolean {
    const saldo = this.obtenerSaldoConDescuento(registro);
    const pagosRealizados = registro.pagos_realizados || 0;
    const pagoCreditoTecnologico = registro.pago_credito_tecnologico || false;

    switch (estado) {
      case 'con_deuda':
        return saldo > 0;
      case 'sin_deuda':
        return saldo === 0;
      case 'saldo_a_favor':
        return saldo < 0;
      case 'sin_pago_cuota':
        return pagosRealizados === 0 && !pagoCreditoTecnologico;
      case 'con_pago_cuota':
        return pagosRealizados > 0 || pagoCreditoTecnologico;
      default:
        return true;
    }
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

    this.exportConfigListado = this.exportService.getDefaultColumns().reduce((config, col) => {
      if (!config.columns) {
        config.columns = [];
      }
      config.columns.push({ ...col });
      return config;
    }, { fileName: 'lista_registros', includeCalculatedFields: true, columns: [] } as ExportConfig);
    
    this.showListadoExportModal = true;
  }

  cerrarModalExportListado(): void {
    this.showListadoExportModal = false;
  }

  async confirmarExportListado(config: ExportConfig): Promise<void> {
    this.showListadoExportModal = false;
    this.isExportingListadoExcel = true;

    try {
      const registrosFiltrados = this.obtenerTodasLasFilasFiltradas();
      const success = await this.exportService.exportToExcel(registrosFiltrados, config);
      
      if (!success) {
        this.toastService.warning('Exportación cancelada', 'No se pudo completar la exportación.');
      }
    } catch (error) {
      console.error('❌ Error exportando Excel:', error);
      this.toastService.error('Error de exportación', 'No se pudo generar el archivo Excel.');
    } finally {
      this.isExportingListadoExcel = false;
    }
  }

  async exportarListadoPDF(): Promise<void> {
    if (this.isGeneratingListadoPDF) {
      return;
    }

    if (!this.hayDatosFiltrados()) {
      this.toastService.warning('Sin datos', 'Aplica filtros con resultados antes de exportar.');
      return;
    }

    this.isGeneratingListadoPDF = true;

    try {
      const registros = this.obtenerTodasLasFilasFiltradas();
      const success = await this.exportService.exportListToPDF(
        registros, 
        (id) => this.getNombreGestion(id),
        (fecha) => this.formatearFecha(fecha)
      );
      
      if (success) {
        this.toastService.success('PDF generado', 'Reporte global exportado correctamente.', 3000);
      } else {
        this.toastService.error('Error de exportación', 'No se pudo generar el archivo PDF.');
      }
    } catch (error) {
      console.error('❌ Error exportando PDF listado:', error);
      this.toastService.error('Error de exportación', 'No se pudo generar el archivo PDF.');
    } finally {
      this.isGeneratingListadoPDF = false;
    }
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

  // Métodos para eliminación de registros
  abrirModalEliminacion(solicitudAgrupada: SolicitudAgrupada): void {
    if (this.isDeletingRegistros) {
      return;
    }

    this.solicitudAEliminar = solicitudAgrupada;
    this.showDeleteModal = true;
  }

  cerrarModalEliminacion(): void {
    this.showDeleteModal = false;
    this.solicitudAEliminar = null;
    this.isDeletingRegistros = false;
  }

  async confirmarEliminacion(): Promise<void> {
    if (!this.solicitudAEliminar) {
      return;
    }

    if (!window.academicoAPI?.updateRegistroEstudiante) {
      this.toastService.error('Funcionalidad no disponible', 'La API de actualización no está accesible en este momento');
      return;
    }

    const registrosAEliminar = this.solicitudAEliminar.registros;
    const cantidadRegistros = registrosAEliminar.length;

    // Validación: si es un grupo, deben eliminarse todos
    if (cantidadRegistros > 1) {
      const tieneIdSolicitud = registrosAEliminar.some(r => r.id_solicitud && !r.id_solicitud.startsWith('individual-'));
      if (tieneIdSolicitud) {
        // Es un apoyo familiar (grupo)
        console.log(`🗑️ Eliminando grupo completo: ${cantidadRegistros} estudiante(s)`);
      }
    }

    this.isDeletingRegistros = true;

    try {
      // Marcar todos los registros del grupo como inactivos y no visibles
      const promesasEliminacion = registrosAEliminar.map(registro => {
        if (!registro.id) {
          throw new Error(`Registro sin ID: ${registro.ci_estudiante}`);
        }

        return window.academicoAPI!.updateRegistroEstudiante(registro.id, {
          inactivo: true,
          visible: false
        });
      });

      await Promise.all(promesasEliminacion);

      // Eliminar el grupo de las colecciones locales
      this.eliminarGrupoLocal(this.solicitudAEliminar.solicitud.id);

      // Mensaje de éxito
      const mensaje = cantidadRegistros > 1 
        ? `Se eliminó el grupo completo (${cantidadRegistros} estudiantes)`
        : 'Se eliminó el registro correctamente';

      this.toastService.success('Eliminación exitosa', mensaje, 3000);

      // Cerrar modal
      this.cerrarModalEliminacion();

      // Recargar datos para reflejar cambios
      await this.cargarDatos();

    } catch (error) {
      console.error('❌ Error eliminando registros:', error);
      this.toastService.error(
        'Error al eliminar', 
        'No se pudieron eliminar los registros. Intente nuevamente.'
      );
      this.isDeletingRegistros = false;
    }
  }

  private eliminarGrupoLocal(solicitudId?: string): void {
    if (!solicitudId) {
      return;
    }

    // Filtrar el grupo de todas las colecciones
    this.solicitudesAgrupadas = this.solicitudesAgrupadas.filter(g => g.solicitud.id !== solicitudId);
    this.solicitudesOriginales = this.solicitudesOriginales.filter(g => g.solicitud.id !== solicitudId);
    this.solicitudesFiltradasTotales = this.solicitudesFiltradasTotales.filter(g => g.solicitud.id !== solicitudId);

    // Recalcular totales
    this.totalItems = this.solicitudesFiltradasTotales.length;

    // Ajustar página si es necesario
    if (this.currentPage > this.totalPages && this.totalPages > 0) {
      this.currentPage = this.totalPages;
    }
  }

  esGrupoFamiliar(solicitudAgrupada: SolicitudAgrupada): boolean {
    return solicitudAgrupada.registros.length > 1;
  }

  obtenerTituloEliminacion(): string {
    if (!this.solicitudAEliminar) {
      return 'Eliminar registro';
    }

    const cantidadRegistros = this.solicitudAEliminar.registros.length;
    return cantidadRegistros > 1 
      ? `Eliminar grupo completo (${cantidadRegistros} estudiantes)`
      : 'Eliminar registro';
  }

  obtenerMensajeEliminacion(): string {
    if (!this.solicitudAEliminar) {
      return '';
    }

    const cantidadRegistros = this.solicitudAEliminar.registros.length;
    
    if (cantidadRegistros > 1) {
      const nombres = this.solicitudAEliminar.registros
        .map(r => r.nombre_estudiante)
        .join(', ');
      
      return `Estás a punto de eliminar el grupo completo de apoyo familiar que incluye a ${cantidadRegistros} estudiantes: ${nombres}. Esta acción marcará todos los registros como no aplicados.`;
    } else {
      const registro = this.solicitudAEliminar.registros[0];
      return `Estás a punto de eliminar el registro de ${registro.nombre_estudiante} (CI: ${registro.ci_estudiante}). Esta acción marcará el registro como no aplicado.`;
    }
  }

  // Métodos para acciones masivas
  toggleBulkActionsMenu(): void {
    this.showBulkActionsMenu = !this.showBulkActionsMenu;
  }

  closeBulkActionsMenu(): void {
    this.showBulkActionsMenu = false;
  }

  abrirModalAccionMasiva(tipo: 'registrado' | 'pendiente' | 'actualizar_datos'): void {
    if (this.isPerformingBulkAction) {
      return;
    }

    if (!this.hayDatosFiltrados()) {
      this.toastService.warning('Sin datos', 'No hay registros filtrados para actualizar.');
      return;
    }

    this.bulkActionType = tipo;
    this.showBulkConfirmModal = true;
    this.closeBulkActionsMenu();
  }

  cerrarModalAccionMasiva(): void {
    this.showBulkConfirmModal = false;
    this.bulkActionType = null;
  }

  getTituloAccionMasiva(): string {
    if (this.bulkActionType === 'registrado') {
      return 'Marcar todos como Registrados';
    } else if (this.bulkActionType === 'pendiente') {
      return 'Marcar todos como Pendientes';
    } else if (this.bulkActionType === 'actualizar_datos') {
      return 'Actualizar U.V.E. y Pagos Realizados';
    }
    return 'Acción Masiva';
  }

  getMensajeAccionMasiva(): string {
    const totalRegistros = this.obtenerTodasLasFilasFiltradas().length;
    
    if (this.bulkActionType === 'registrado') {
      return `Estás a punto de actualizar ${totalRegistros} registro(s) filtrado(s) como "registrados". Esta acción actualizará todos los registros que cumplan con los filtros actuales.`;
    } else if (this.bulkActionType === 'pendiente') {
      return `Estás a punto de actualizar ${totalRegistros} registro(s) filtrado(s) como "pendientes". Esta acción actualizará todos los registros que cumplan con los filtros actuales.`;
    } else if (this.bulkActionType === 'actualizar_datos') {
      return `Estás a punto de actualizar los créditos académicos y de pagos de ${totalRegistros} registro(s) filtrado(s). Esta acción consultará la API externa para obtener el total de U.V.E. actuales y los pagos realizados por cada estudiante.`;
    }
    
    return '';
  }

  getCantidadRegistrosAfectados(): number {
    return this.obtenerTodasLasFilasFiltradas().length;
  }

  async confirmarAccionMasiva(): Promise<void> {
    if (!this.bulkActionType) {
      return;
    }

    // Manejar actualización de datos académicos
    if (this.bulkActionType === 'actualizar_datos') {
      await this.actualizarDatosAcademicos();
      return;
    }

    // Verificar disponibilidad de API masiva (preferida) o individual (fallback)
    if (!window.academicoAPI?.updateRegistroEstudianteBulk && !window.academicoAPI?.updateRegistroEstudiante) {
      this.toastService.error('Funcionalidad no disponible', 'La API de actualización no está accesible en este momento');
      return;
    }

    const registrosFiltrados = this.obtenerTodasLasFilasFiltradas();
    const nuevoEstado = this.bulkActionType === 'registrado';
    const ids = registrosFiltrados.map(r => r.id).filter(Boolean) as string[];
    
    if (ids.length === 0) {
      this.toastService.warning('Sin registros válidos', 'No hay registros con ID válido para actualizar.');
      return;
    }

    this.isPerformingBulkAction = true;

    try {
      // OPCIÓN 1: Usar endpoint masivo (RECOMENDADO - más eficiente)
      if (window.academicoAPI.updateRegistroEstudianteBulk) {
        const resultado = await window.academicoAPI.updateRegistroEstudianteBulk(ids, {
          registrado: nuevoEstado
        });

        if (!resultado.success) {
          throw new Error('La actualización masiva no se completó correctamente');
        }

        console.log(`✅ Actualización masiva: ${resultado.affectedRows} registros actualizados`);

        // Actualizar localmente todos los registros
        registrosFiltrados.forEach(registro => {
          if (registro.id) {
            this.actualizarRegistroLocal(registro.id, { registrado: nuevoEstado });
          }
        });

        const mensajeExito = nuevoEstado 
          ? `${resultado.affectedRows} registro(s) marcado(s) como Registrados`
          : `${resultado.affectedRows} registro(s) marcado(s) como Pendientes`;

        this.toastService.success('Actualización masiva exitosa', mensajeExito, 4000);
      } 
      // OPCIÓN 2: Fallback a múltiples llamadas individuales (menos eficiente)
      else {
        console.warn('⚠️ Usando actualización individual (múltiples llamadas). Considera implementar updateBulk en el backend.');
        
        const promesasActualizacion = registrosFiltrados.map(registro => {
          if (!registro.id) {
            throw new Error(`Registro sin ID: ${registro.ci_estudiante}`);
          }

          return window.academicoAPI!.updateRegistroEstudiante(registro.id, {
            registrado: nuevoEstado
          });
        });

        await Promise.all(promesasActualizacion);

        // Actualizar localmente todos los registros
        registrosFiltrados.forEach(registro => {
          if (registro.id) {
            this.actualizarRegistroLocal(registro.id, { registrado: nuevoEstado });
          }
        });

        const mensajeExito = nuevoEstado 
          ? `${registrosFiltrados.length} registro(s) marcado(s) como Registrados`
          : `${registrosFiltrados.length} registro(s) marcado(s) como Pendientes`;

        this.toastService.success('Actualización masiva exitosa', mensajeExito, 4000);
      }

      // Cerrar modal
      this.cerrarModalAccionMasiva();

    } catch (error) {
      console.error('❌ Error en actualización masiva:', error);
      this.toastService.error(
        'Error en actualización masiva', 
        'No se pudieron actualizar todos los registros. Intente nuevamente.'
      );
    } finally {
      this.isPerformingBulkAction = false;
    }
  }

  /**
   * Actualiza los datos académicos (U.V.E. y pagos realizados) de todos los registros filtrados.
   * Consulta la API externa para obtener información actualizada de cada estudiante.
   */
  async actualizarDatosAcademicos(): Promise<void> {
    const registrosFiltrados = this.obtenerTodasLasFilasFiltradas();
    
    if (registrosFiltrados.length === 0) {
      this.toastService.warning('Sin registros', 'No hay registros para actualizar.');
      return;
    }

    this.isPerformingBulkAction = true;

    try {
      // Pre-cargar mapas para optimización O(1)
      const beneficiosMap = new Map<string, Beneficio>();
      this.beneficioService.currentData.forEach((b: Beneficio) => {
        beneficiosMap.set(b.nombre.toLowerCase(), b);
      });

      const carrerasMap = new Map<string, any>();
      this.carreraService.currentData.forEach((c: any) => {
        const carreraNormalized = c.carrera.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
        carrerasMap.set(carreraNormalized, c);
      });

      // Contadores para reporte
      let actualizados = 0;
      let errores = 0;
      const registrosActualizados: Array<{ id: string; datos: Partial<RegistroEstudiante> }> = [];

      // Procesar en lotes para mejor rendimiento
      const BATCH_SIZE = 5;

      for (let i = 0; i < registrosFiltrados.length; i += BATCH_SIZE) {
        const batch = registrosFiltrados.slice(i, i + BATCH_SIZE);  
        const progreso = Math.min(i + BATCH_SIZE, registrosFiltrados.length);

        // Mostrar progreso en consola
        console.log(`📊 Procesando estudiantes... (${progreso}/${registrosFiltrados.length})`);

        // Procesar lote en paralelo
        const results = await Promise.allSettled(
          batch.map(estudiante => 
            this.procesarEstudianteOptimizado(
              estudiante,
              beneficiosMap,
              carrerasMap
            )
          )
        );

        // Contar resultados
        results.forEach((result, index) => {
          if (result.status === 'fulfilled' && result.value) {
            actualizados++;
            registrosActualizados.push(result.value);
          } else {
            errores++;
            console.error(`❌ Error procesando ${batch[index].nombre_estudiante}:`, 
              result.status === 'rejected' ? result.reason : 'Sin datos');
          }
        });
      }

      // Actualizar en base de datos usando bulk update
      if (registrosActualizados.length > 0) {
        console.log(`💾 Actualizando ${registrosActualizados.length} registros en base de datos...`);

        if (window.academicoAPI?.updateRegistroEstudianteBulk) {
          // Usar bulk update (más eficiente)
          for (const { id, datos } of registrosActualizados) {
            await window.academicoAPI.updateRegistroEstudiante(id, datos);
            
            // Actualizar localmente
            this.actualizarRegistroLocal(id, datos);
          }
        } else {
          // Fallback: actualización individual
          for (const { id, datos } of registrosActualizados) {
            await window.academicoAPI!.updateRegistroEstudiante(id, datos);
            
            // Actualizar localmente
            this.actualizarRegistroLocal(id, datos);
          }
        }
      }

      // Mostrar resultado
      if (actualizados > 0) {
        this.toastService.success(
          'Actualización completada',
          `${actualizados} registro(s) actualizado(s) correctamente.${errores > 0 ? ` ${errores} error(es).` : ''}`,
          4000
        );
      } else {
        this.toastService.warning(
          'Sin actualizaciones',
          'No se pudieron actualizar los registros. Verifique la conexión con la API externa.',
          4000
        );
      }

      this.cerrarModalAccionMasiva();

    } catch (error) {
      console.error('❌ Error en actualización masiva:', error);
      this.toastService.error(
        'Error en actualización',
        'No se pudieron actualizar los datos académicos. Intente nuevamente.'
      );
    } finally {
      this.isPerformingBulkAction = false;
    }
  }

  /**
   * Procesa un estudiante individual y retorna los datos actualizados
   * Optimizado con Maps para O(1) lookups
   */
  private async procesarEstudianteOptimizado(
    estudiante: RegistroEstudiante,
    beneficiosMap: Map<string, Beneficio>,
    carrerasMap: Map<string, any>
  ): Promise<{ id: string; datos: Partial<RegistroEstudiante> } | null> {
    if (!window.academicoAPI || !estudiante.id_estudiante_siaan || !estudiante.id) {
      return null;
    }

    try {
      const idEstudiante = estudiante.id_estudiante_siaan;

      // Obtener kardex
      const kardex = await window.academicoAPI.obtenerKardexEstudiante(idEstudiante);

      // Obtener gestiones del estudiante (semestral + anual)
      const gestionEstudiante = this.gestionService.currentData.find(g => g.id === estudiante.id_gestion);
      if (!gestionEstudiante) {
        throw new Error('No se encontró la gestión del estudiante');
      }

      const gestionAnual = this.gestionService.currentData.find(
        g => g.anio === gestionEstudiante.anio && g.tipo === 'Anual'
      );
      const gestionesActuales: Gestion[] = [gestionEstudiante, gestionAnual].filter(Boolean) as Gestion[];

      // Obtener información del kardex
      const [materias, carrera] = await this.academicoUtils.obtenerInformacionKardex(kardex, gestionesActuales);
      const totalCreditos = await this.academicoUtils.calcularTotalUVE(materias);


      // Obtener plan de pago realizado
      const [referencia, planAccedido, pagoRealizado, sinPago, pagosSemestre, pagoCreditoTecnologico] = 
        await this.academicoUtils.obtenerPlanDePagoRealizado(idEstudiante, gestionesActuales);

      // OPTIMIZATION: O(1) lookup from map
      const carreraNormalized = carrera.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      const carreraInfo = carrerasMap.get(carreraNormalized);

      if (!carreraInfo) {
        throw new Error(`No se encontró información de la carrera: ${carrera}`);
      }

      // Calcular valores
      const valorCredito = carreraInfo.tarifario?.valor_credito || 0;
      const creditoTecnologico = carreraInfo.incluye_tecnologico ? valorCredito : 0;
      const totalSemestre = (valorCredito * totalCreditos) + creditoTecnologico;

      // Preparar datos actualizados
      const datosActualizados: Partial<RegistroEstudiante> = {
        total_creditos: totalCreditos,
        valor_credito: valorCredito,
        credito_tecnologico: creditoTecnologico,
        pagos_realizados: pagosSemestre,
        pago_credito_tecnologico: pagoCreditoTecnologico,
        total_semestre: totalSemestre,
        materias: materias // Almacenar las materias para ver en el modal
      };

      console.log(`✅ ${estudiante.nombre_estudiante}: ${totalCreditos} UVE, Pagos: ${pagosSemestre} Bs.`);

      return {
        id: estudiante.id,
        datos: datosActualizados
      };

    } catch (error) {
      console.error(`❌ Error procesando ${estudiante.nombre_estudiante}:`, error);
      return null;
    }
  }
}
