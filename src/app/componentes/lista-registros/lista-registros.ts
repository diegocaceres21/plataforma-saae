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
import { CarreraService } from '../../servicios/carrera.service';
import { GestionService } from '../../servicios/gestion.service';
import { Subject, takeUntil, debounceTime, distinctUntilChanged } from 'rxjs';
import '../../interfaces/electron-api';

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
  imports: [CommonModule, FormsModule, RouterModule, ToastContainerComponent, MultiSelectDropdownComponent],
  templateUrl: './lista-registros.html',
  styleUrl: './lista-registros.scss'
})
export class ListaRegistrosComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();

  // Datos principales
  registrosEstudiantes: RegistroEstudiante[] = [];
  solicitudesAgrupadas: SolicitudAgrupada[] = [];
  solicitudesOriginales: SolicitudAgrupada[] = [];
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
  
  // Configuración de filtrado
  mostrarSoloEstudiantesFiltrados = true; // false = mostrar toda la solicitud, true = solo estudiantes filtrados

  // Dropdown options
  gestionOptions: MultiSelectOption[] = [];
  carreraOptions: MultiSelectOption[] = [];
  descuentoOptions: MultiSelectOption[] = [];

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

      console.log('📊 Datos cargados:', {
        registros: this.registrosEstudiantes.length,
        solicitudes: this.solicitudesAgrupadas.length
      });

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

      this.gestiones = this.gestionService.currentData || [];
      this.carreras = this.carreraService.currentData || [];

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

    } catch (error) {
      console.error('❌ Error cargando datos de filtros:', error);
    } finally {
      this.isLoadingFiltros = false;
    }
  }

  agruparPorSolicitud(): void {
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
        registros: registrosConSolicitud.sort((a, b) => a.nombre_estudiante.localeCompare(b.nombre_estudiante)),
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
        return 'badge-success';
      case 'pendiente':
        return 'badge-warning';
      case 'procesado':
        return 'badge-info';
      case 'cancelado':
        return 'badge-danger';
      default:
        return 'badge-secondary';
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
}