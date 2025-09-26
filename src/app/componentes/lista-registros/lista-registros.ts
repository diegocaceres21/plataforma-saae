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
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
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

  // Vista detallada de solicitud
  showDetailModal = false;
  selectedSolicitud: SolicitudAgrupada | null = null;
  expandedDetailItems: Set<number> = new Set();
  
  // Estados para exportación desde vista detallada
  isExportingDetail = false;
  isGeneratingPDFDetail = false;

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
          'Archivo PDF descargado exitosamente'
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
}