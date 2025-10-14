import { Component, inject, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { Subject, takeUntil } from 'rxjs';
import { ReportePagosDataService } from '../servicios/reporte-pagos-data.service';
import { ReportePagosData } from '../interfaces/pago-reporte';
import PizZip from 'pizzip';
import Docxtemplater from 'docxtemplater';
import { saveAs } from 'file-saver';

@Component({
  selector: 'app-reporte',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './reporte.html',
  styleUrl: './reporte.scss'
})
export class Reporte implements OnInit, OnDestroy {
  private router = inject(Router);
  private reporteDataService = inject(ReportePagosDataService);
  private destroy$ = new Subject<void>();

  reporteData: ReportePagosData | null = null;

  ngOnInit(): void {
    this.reporteDataService.reporteData$
      .pipe(takeUntil(this.destroy$))
      .subscribe(data => {
        this.reporteData = data;
        
        // Si no hay datos, redirigir a búsqueda
        if (!data) {
          this.router.navigate(['/reporte-pagos']);
        }
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  get totalImporte(): number {
    if (!this.reporteData?.pagos) return 0;
    return this.reporteData.pagos.reduce((sum, pago) => sum + pago.monto, 0);
  }

  volverABusqueda(): void {
    this.reporteDataService.clearReporteData();
    this.router.navigate(['/reporte-pagos']);
  }

  // Métodos placeholder para exportación (se implementarán después)
  exportarPDF(): void {
    console.log('Exportar a PDF - Por implementar');
  }

  exportarExcel(): void {
    console.log('Exportar a Excel - Por implementar');
  }


  async exportarWord() {
    const response = await fetch('certificado.docx');
    const arrayBuffer = await response.arrayBuffer();

    const zip = new PizZip(arrayBuffer);
    const doc = new Docxtemplater(zip, { paragraphLoop: true, linebreaks: true });

    // Formatear pagos para la tabla
    const pagosFormateados = this.reporteData?.pagos.map(pago => ({
      ...pago,
      fecha: this.formatearFecha(pago.fecha),
      monto: this.formatearMonto(pago.monto)
    })) || [];

    // Determinar fechas de inicio y fin
    const fechaInicio = this.reporteData?.fechaInicio 
      ? this.reporteData.fechaInicio 
      : this.reporteData?.pagos[this.reporteData.pagos.length - 1].fecha;
    
    const fechaFin = this.reporteData?.fechaFin 
      ? this.reporteData.fechaFin 
      : this.reporteData?.pagos[0].fecha;

    // Datos dinámicos
    const data = {
      nombre_completo: this.reporteData?.estudiante.nombre,
      ci_estudiante: this.reporteData?.estudiante.carnet,
      carrera: this.reporteData?.estudiante.carrera,
      fecha_inicio: this.formatearFechaLarga(fechaInicio),
      fecha_fin: this.formatearFechaLarga(fechaFin),
      fecha_hoy: this.formatearFechaLarga(new Date()),
      tabla_detalle: pagosFormateados,
      total_importe: this.formatearMonto(this.totalImporte)
    };

    try {
      doc.render(data);
    } catch (error) {
      console.error(error);
      return;
    }

    const output = doc.getZip().generate({ type: 'blob' });
    saveAs(output, `Certificación_${data.nombre_completo}.docx`);
  }

  private formatearFecha(fecha: string | Date): string {
    const date = typeof fecha === 'string' ? new Date(fecha) : fecha;
    const dia = date.getDate().toString().padStart(2, '0');
    const mes = (date.getMonth() + 1).toString().padStart(2, '0');
    const anio = date.getFullYear();
    return `${dia}/${mes}/${anio}`;
  }

  private formatearMonto(monto: number): string {
    // Formatear con separador de miles (coma) y dos decimales
    return monto.toLocaleString('es-BO', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
  }

  private formatearFechaLarga(fecha: string | Date | undefined): string {
    if (!fecha) return '';
    
    const date = typeof fecha === 'string' ? new Date(fecha) : fecha;
    
    const meses = [
      'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
      'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'
    ];
    
    const dia = date.getDate();
    const mes = meses[date.getMonth()];
    const anio = date.getFullYear();
    
    return `${dia.toString().padStart(2, '0')} de ${mes} de ${anio}`;
  }

 
}
