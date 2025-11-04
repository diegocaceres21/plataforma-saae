import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ToastService } from '../../../../shared/servicios/toast';
import { LoadingService } from '../../../../shared/servicios/loading';
import { ToastContainerComponent } from '../../../../shared/componentes/toast-container/toast-container';
import { GestionService } from '../../../servicios/gestion.service';
import { Gestion } from '../../../interfaces/gestion';
import { RegistroEstudiante } from '../../../interfaces/registro-estudiante';
import { Beneficio } from '../../../interfaces/beneficio';
import { BeneficioService } from '../../../servicios/beneficio.service';

interface EstudianteConInactivos {
  ci_estudiante: string;
  nombre_estudiante: string;
  registros: RegistroEstudiante[];
}

@Component({
  selector: 'app-reporte-duplicados',
  imports: [CommonModule, FormsModule, RouterLink, ToastContainerComponent],
  templateUrl: './reporte-duplicados.html',
  styleUrl: './reporte-duplicados.scss'
})
export class ReporteDuplicados implements OnInit {
  private toastService = inject(ToastService);
  private loadingService = inject(LoadingService);
  private beneficioService = inject(BeneficioService);

  // Filter state
  gestiones: Gestion[] = [];
  selectedGestionId: string = '';
  searchText: string = '';
  beneficios: Beneficio[] = [];

  // Data
  estudiantes: EstudianteConInactivos[] = [];
  filteredEstudiantes: EstudianteConInactivos[] = [];
  isLoading: boolean = false;

  async ngOnInit() {
    if (!window.academicoAPI?.getSemesterGestion) {
        throw new Error('API getSemesterGestion no disponible');
    }

    const data: Gestion[] = await window.academicoAPI.getSemesterGestion();
    this.gestiones = data;
    
    this.beneficios = await this.beneficioService.currentData;
    //await this.gestionService.loadGestionData();
    
    if (this.gestiones.length > 0) {
      // Select the first active gestion by default
      const activeGestion = this.gestiones.find((g: Gestion) => g.activo);
      this.selectedGestionId = activeGestion?.id || this.gestiones[0].id;
      await this.cargarDatos();
    }
  }

  obtenerNombreBeneficio(id_beneficio: string): string {
    const beneficio = this.beneficios.find(b => b.id === id_beneficio);
    return beneficio ? beneficio.nombre : 'Desconocido';
  }
  async cargarDatos() {
    if (!this.selectedGestionId) {
      this.toastService.warning('Seleccionar Gestión', 'Debe seleccionar una gestión', 3000);
      return;
    }

    this.isLoading = true;
    this.loadingService.show();

    try {
      const filters = {
        id_gestion: this.selectedGestionId,
        search: this.searchText.trim() || undefined
      };

      const result = await window.academicoAPI?.getEstudiantesConInactivos(filters);
      this.estudiantes = result || [];
      this.aplicarFiltros();
    
    } catch (error: any) {
      console.error('Error loading data:', error);
      this.toastService.error(
        'Error',
        'No se pudieron cargar los datos: ' + (error.message || 'Error desconocido'),
        5000
      );
      this.estudiantes = [];
      this.filteredEstudiantes = [];
    } finally {
      this.isLoading = false;
      this.loadingService.hide();
    }
  }

  aplicarFiltros() {
    let filtered = [...this.estudiantes];

    // Filter by search text
    if (this.searchText.trim()) {
      const search = this.searchText.toLowerCase();
      filtered = filtered.filter((e: EstudianteConInactivos) => 
        e.nombre_estudiante.toLowerCase().includes(search) ||
        e.ci_estudiante.toLowerCase().includes(search)
      );
    }

    this.filteredEstudiantes = filtered;
  }

  onGestionChange() {
    this.cargarDatos();
  }

  onSearchChange() {
    this.aplicarFiltros();
  }

  // Get active benefits for a student
  getBeneficiosActivos(estudiante: EstudianteConInactivos): RegistroEstudiante[] {
    return estudiante.registros.filter((r: RegistroEstudiante) => !r.inactivo);
  }

  // Get inactive benefits for a student
  getBeneficiosInactivos(estudiante: EstudianteConInactivos): RegistroEstudiante[] {
    return estudiante.registros.filter((r: RegistroEstudiante) => r.inactivo);
  }

  // Export to Excel
  async exportarExcel() {
    if (this.filteredEstudiantes.length === 0) {
      this.toastService.warning('Sin Datos', 'No hay datos para exportar', 3000);
      return;
    }

    try {
      const gestionNombre = this.gestiones.find((g: Gestion) => g.id === this.selectedGestionId)?.gestion || 'Desconocido';
      
      // Prepare data for export
      const data = this.filteredEstudiantes.flatMap((estudiante: EstudianteConInactivos) => {
        const activos = this.getBeneficiosActivos(estudiante);
        const inactivos = this.getBeneficiosInactivos(estudiante);
        
        return inactivos.map((inactivo: RegistroEstudiante) => ({
          'CI Estudiante': estudiante.ci_estudiante,
          'Nombre': estudiante.nombre_estudiante,
          'Beneficio No aplicado': this.obtenerNombreBeneficio(inactivo.id_beneficio!),
          'Porcentaje No Aplicado': inactivo.porcentaje_descuento,
          'Fecha Registro No Aplicado': new Date(inactivo.created_at!).toLocaleDateString(),
          'Beneficio Activo': activos.length > 0 ? this.obtenerNombreBeneficio(activos[0].id_beneficio!) : 'Ninguno',
          'Porcentaje Activo': activos.length > 0 ? activos[0].porcentaje_descuento : 0
        }));
      });

      // Create Excel workbook
      const XLSX = await import('xlsx');
      const ws = XLSX.utils.json_to_sheet(data);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Beneficios No Aplicados');
      
      // Save file
      XLSX.writeFile(wb, `Reporte_Beneficios_No_Aplicados_${gestionNombre}.xlsx`);

      this.toastService.success('Exportado', 'Reporte exportado a Excel exitosamente', 3000);
    } catch (error: any) {
      console.error('Error exporting to Excel:', error);
      this.toastService.error('Error', 'No se pudo exportar a Excel', 5000);
    }
  }

  // Export to PDF
  async exportarPDF() {
    if (this.filteredEstudiantes.length === 0) {
      this.toastService.warning('Sin Datos', 'No hay datos para exportar', 3000);
      return;
    }

    try {
      const gestionNombre = this.gestiones.find((g: Gestion) => g.id === this.selectedGestionId)?.gestion || 'Desconocido';
      
      // Prepare data for export
      const rows = this.filteredEstudiantes.flatMap((estudiante: EstudianteConInactivos) => {
        const activos = this.getBeneficiosActivos(estudiante);
        const inactivos = this.getBeneficiosInactivos(estudiante);
        
        return inactivos.map((inactivo: RegistroEstudiante) => [
          estudiante.ci_estudiante,
          estudiante.nombre_estudiante,
          this.obtenerNombreBeneficio(inactivo.id_beneficio!) || 'N/A',
          `${(inactivo.porcentaje_descuento * 100).toFixed(0)}%`,
          activos.length > 0 ? this.obtenerNombreBeneficio(activos[0].id_beneficio!) : 'Ninguno',
          activos.length > 0 ? `${(activos[0].porcentaje_descuento * 100).toFixed(0)}%` : '0%'
        ]);
      });

      // Create PDF using jsPDF
      const jsPDF = (await import('jspdf')).default;
      const doc = new jsPDF('l', 'mm', 'a4'); // Landscape orientation
      
      doc.setFontSize(18);
      doc.text(`Reporte de Beneficios No Aplicados - ${gestionNombre}`, 15, 15);
      
      // Add autoTable
      const autoTable = (await import('jspdf-autotable')).default;
      autoTable(doc, {
        head: [['CI', 'Estudiante', 'Beneficio No Aplicado', '% No Aplicado', 'Beneficio Activo', '% Activo']],
        body: rows,
        startY: 25,
        theme: 'striped',
        headStyles: { fillColor: [41, 128, 185] },
        styles: { fontSize: 10 }
      });
      
      // Save PDF
      doc.save(`Reporte_Beneficios_No_Aplicados_${gestionNombre}.pdf`);

      this.toastService.success('Exportado', 'Reporte exportado a PDF exitosamente', 3000);
    } catch (error: any) {
      console.error('Error exporting to PDF:', error);
      this.toastService.error('Error', 'No se pudo exportar a PDF', 5000);
    }
  }

  // Format date
  formatDate(date: string | Date): string {
    return new Date(date).toLocaleDateString();
  }
}
