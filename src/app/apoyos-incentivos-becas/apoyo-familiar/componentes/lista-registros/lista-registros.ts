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
  exportConfigListado: ExportConfig = this.crearConfigExportacionPorDefecto();

  // Dropdown options
  gestionOptions: MultiSelectOption[] = [];
  carreraOptions: MultiSelectOption[] = [];
  planOptions: MultiSelectOption[] = [];
  beneficioOptions: MultiSelectOption[] = [];

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
      case 'tipo_beneficio':
        return this.getNombreBeneficio(registro.id_beneficio).toUpperCase();
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
      tipo_beneficio: 25,
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
      { key: 'tipo_beneficio', label: 'Tipo de Beneficio', enabled: true },
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
      
      return `Estás a punto de eliminar el grupo completo de apoyo familiar que incluye a ${cantidadRegistros} estudiantes: ${nombres}. Esta acción marcará todos los registros como inactivos.`;
    } else {
      const registro = this.solicitudAEliminar.registros[0];
      return `Estás a punto de eliminar el registro de ${registro.nombre_estudiante} (CI: ${registro.ci_estudiante}). Esta acción marcará el registro como inactivo.`;
    }
  }
}
