import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { RegistroEstudiante } from '../../interfaces/registro-estudiante';
import { Gestion } from '../../interfaces/gestion';
import { Carrera } from '../../interfaces/carrera';
import { Solicitud } from '../../interfaces/solicitud';
import { ToastService } from '../../servicios/toast';
import { ToastContainerComponent } from '../shared/toast-container/toast-container';
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
  imports: [CommonModule, FormsModule, RouterModule, ToastContainerComponent],
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

  // Estados de loading
  isLoading = false;
  isLoadingFiltros = false;

  // Filtros
  filtroGestion = '';
  filtroBusqueda = '';
  filtroCarrera = '';

  // Paginación
  currentPage = 1;
  itemsPerPage = 10;
  totalItems = 0;

  constructor(private toastService: ToastService) {}

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

      if (!window.academicoAPI?.getAllGestion || !window.academicoAPI?.getAllCarrera) {
        return;
      }

      const [gestiones, carreras] = await Promise.all([
        window.academicoAPI.getAllGestion(),
        window.academicoAPI.getAllCarrera()
      ]);

      this.gestiones = gestiones || [];
      this.carreras = carreras || [];

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

    // Filtro por gestión
    if (this.filtroGestion) {
      solicitudesFiltradas = solicitudesFiltradas.filter(item => 
        item.solicitud.id_gestion === this.filtroGestion
      );
    }

    // Filtro por carrera
    if (this.filtroCarrera) {
      solicitudesFiltradas = solicitudesFiltradas.filter(item =>
        item.registros.some((registro: RegistroConSolicitud) => 
          registro.carrera.toLowerCase().includes(this.filtroCarrera.toLowerCase())
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

    // Aplicar paginación
    this.totalItems = solicitudesFiltradas.length;
    const startIndex = (this.currentPage - 1) * this.itemsPerPage;
    this.solicitudesAgrupadas = solicitudesFiltradas.slice(startIndex, startIndex + this.itemsPerPage);
  }

  onFiltroChange(): void {
    this.currentPage = 1; // Resetear a primera página
    this.aplicarFiltros();
  }

  limpiarFiltros(): void {
    this.filtroGestion = '';
    this.filtroBusqueda = '';
    this.filtroCarrera = '';
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
}