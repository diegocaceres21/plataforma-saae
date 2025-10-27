import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { StudentAutocompleteComponent } from '../../shared/componentes/student-autocomplete/student-autocomplete';
import { StudentSearchResult } from '../../shared/interfaces/student-search';
import { LoadingService } from '../../shared/servicios/loading';
import { ReportePagosDataService } from '../servicios/reporte-pagos-data.service';
import { PagoReporte } from '../interfaces/pago-reporte';
import { ToastService } from '../../shared/servicios/toast';
import { ToastContainerComponent } from '../../shared/componentes/toast-container/toast-container';


@Component({
  selector: 'app-busqueda',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, StudentAutocompleteComponent, ToastContainerComponent],
  templateUrl: './busqueda.html',
  styleUrl: './busqueda.scss'
})
export class Busqueda {
  private router = inject(Router);
  private reporteDataService = inject(ReportePagosDataService);
  private toastService = inject(ToastService);
  
  selectedStudent: StudentSearchResult | null = null;
  
  // Filtro de fechas
  fechaInicio: string = '';
  fechaFin: string = '';
  showDateFilter: boolean = false;
  loadingService = inject(LoadingService);

  onStudentSelected(student: StudentSearchResult) {
    this.selectedStudent = student;
  }

  toggleDateFilter() {
    this.showDateFilter = !this.showDateFilter;
    // Limpiar fechas si se oculta el filtro
    if (!this.showDateFilter) {
      this.fechaInicio = '';
      this.fechaFin = '';
    }
  }

  clearDateFilter() {
    this.fechaInicio = '';
    this.fechaFin = '';
  }

  async onSearch() {
    // Validar que se haya seleccionado un estudiante
    if (!this.selectedStudent) {
      console.warn('No se ha seleccionado ningún estudiante');
      return;
    }

    // Validar fechas si el filtro está activo
    if (this.showDateFilter) {
      if (this.fechaInicio && this.fechaFin) {
        const inicio = new Date(this.fechaInicio);
        const fin = new Date(this.fechaFin);
        
        if (inicio > fin) {
          console.warn('La fecha de inicio no puede ser mayor que la fecha fin');
          return;
        }
      }
    }

    this.loadingService.show('Obteniendo datos de pagos...');
    const carrera = await window.academicoAPI?.obtenerCarrera(this.selectedStudent.id);
    const reportePagos = await this.obtenerDetallesDePagos(this.selectedStudent.id);
    this.loadingService.hide();
    
    // Validar si hay datos
    if (!reportePagos || reportePagos.length === 0) {
      this.toastService.warning(
        'Sin resultados',
        'No se encontraron pagos para el estudiante seleccionado'
      );
      return;
    }
    
    // Guardar datos en el servicio y navegar al reporte
    this.reporteDataService.setReporteData({
      estudiante: {
        nombre: this.selectedStudent.nombre,
        carnet: this.selectedStudent.carnet,
        carrera: carrera
      },
      pagos: reportePagos,
      fechaInicio: this.showDateFilter ? this.fechaInicio : undefined,
      fechaFin: this.showDateFilter ? this.fechaFin : undefined
    });
    
    this.router.navigate(['/resultado-pagos']);
  }

  
  parseFecha(fechaStr: string): Date {
    const [fecha, hora] = fechaStr.split(" ");
    const [dia, mes, anio] = fecha.split("/").map(Number);
    const [horas, minutos, segundos] = hora.split(":").map(Number);

    // En JS los meses van de 0 (enero) a 11 (diciembre)
    return new Date(anio, mes - 1, dia, horas, minutos, segundos);
  }

  async obtenerDetallesDePagos(id_estudiante: string): Promise<PagoReporte[]> {
    let reportePagos: PagoReporte[] = [];
    try {
      if (!window.academicoAPI?.obtenerPagosRealizados) {
        throw new Error('obtenerPagosRealizados API not available');
      }

      const pagos = await window.academicoAPI.obtenerPagosRealizados(id_estudiante, 500);
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
                orden,
                true
              );
              
              const pagoReporte: PagoReporte = {
                fecha: this.parseFecha(detalleFactura.fecha),
                factura: pago[1]?.contenidoCelda?.[0]?.contenido,
                beneficiario: detalleFactura.beneficiario,
                nit: detalleFactura.nit,
                monto: parseFloat((pago[5]?.contenidoCelda?.[0]?.contenido || "0").replace(",", ""))
              };
              
              // Aplicar filtro de fechas si está activo
              if (this.showDateFilter && this.fechaInicio && this.fechaFin) {
                const fechaPago = new Date(pagoReporte.fecha);
                const inicio = new Date(this.fechaInicio);
                const fin = new Date(this.fechaFin);
                
                // Incluir solo pagos dentro del rango
                if (fechaPago >= inicio && fechaPago <= fin) {
                  reportePagos.push(pagoReporte);
                }
              } else {
                reportePagos.push(pagoReporte);
              }
            }
          }
        }
      }
      
      // Ordenar por fecha (más reciente primero)
      reportePagos.sort((a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime());
      
      if(this.fechaInicio && this.fechaFin) {   
        reportePagos = reportePagos.filter(pago => {
          const fechaPago = new Date(pago.fecha);
          const inicio = new Date(this.fechaInicio);
          const fin = new Date(this.fechaFin);
          return fechaPago >= inicio && fechaPago <= fin;
        });
      }
      return reportePagos;
    } catch (error) {
      console.error('Error en obtenerDetallesDePagos:', error);
      this.toastService.error(
        'Error al obtener pagos',
        'No se pudieron obtener los pagos del estudiante'
      );
    }

    return [];
  }
}
