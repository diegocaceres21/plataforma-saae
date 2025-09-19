import { Component, OnInit, OnDestroy } from '@angular/core';
import { RegistroEstudiante } from '../../../interfaces/registro-estudiante';
import { Solicitud } from '../../../interfaces/solicitud';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import * as XLSX from 'xlsx';
import { ToastService } from '../../../servicios/toast';
import { ToastContainerComponent } from '../../shared/toast-container/toast-container';
import { ExportConfigModalComponent } from '../../shared/export-config-modal/export-config-modal';
import { ExportConfig } from '../../../interfaces/export-config';
import jsPDF from 'jspdf';
import { Subject, takeUntil } from 'rxjs';
import { RegistroIndividualDataService } from '../../../servicios/registro-individual-data';
import '../../../interfaces/electron-api'; // Importar tipos de Electron

@Component({
  selector: 'app-vista-individual',
  imports: [CommonModule, RouterModule, ToastContainerComponent, ExportConfigModalComponent],
  templateUrl: './vista-individual.html',
  styleUrl: './vista-individual.scss'
})
export class VistaIndividual implements OnInit, OnDestroy {
  
  registrosEstudiantes: Partial<RegistroEstudiante>[] = [];
  hasValidData = false;
  private destroy$ = new Subject<void>();

  ngOnInit() {
    // Suscribirse a los datos del servicio
    this.dataService.registrosEstudiantes$
      .pipe(takeUntil(this.destroy$))
      .subscribe(registros => {
        this.registrosEstudiantes = registros;
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

  constructor(private toastService: ToastService, private dataService: RegistroIndividualDataService) {}

  expandedItems: Set<number> = new Set();
  
  // Estados para feedback visual
  isExporting = false;
  isSaving = false;
  isGeneratingPDF = false;
  isPrinting = false;
  
  // Modal de configuración
  showExportModal = false;
  exportConfig: ExportConfig | null = null;

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

      console.log('📝 Creando solicitud:', solicitudData);
      const solicitud = await window.academicoAPI.createSolicitud(solicitudData);
      
      if (!solicitud || !solicitud.id) {
        throw new Error('No se pudo crear la solicitud');
      }

      console.log('✅ Solicitud creada con ID:', solicitud.id);

      // Paso 2: Preparar los datos de los estudiantes con el ID de solicitud
      const registrosParaGuardar = this.registrosEstudiantes.map(registro => ({
        id_solicitud: solicitud.id,
        id_gestion: gestionId,
        id_estudiante_siaan: registro.id_estudiante_siaan || '',
        ci_estudiante: registro.ci_estudiante || '',
        nombre_estudiante: registro.nombre_estudiante || '',
        carrera: registro.carrera || '',
        total_creditos: registro.total_creditos || 0,
        valor_credito: registro.valor_credito || 0,
        credito_tecnologico: registro.credito_tecnologico || 0,
        porcentaje_descuento: registro.porcentaje_descuento || 0,
        monto_primer_pago: registro.monto_primer_pago || 0,
        plan_primer_pago: registro.plan_primer_pago || '',
        referencia_primer_pago: registro.referencia_primer_pago || 'SIN-REF',
        total_semestre: registro.total_semestre || 0,
        registrado: true,
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
        registro.registrado = true;
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

  exportarPDF(): void {
    if (this.registrosEstudiantes.length === 0) {
      this.toastService.warning(
        'Sin Datos', 
        'No hay registros disponibles para exportar'
      );
      return;
    }
    
    this.isGeneratingPDF = true;
    
    try {
      // Simular tiempo de procesamiento
      setTimeout(() => {
        this.generatePDFDocument();
        this.isGeneratingPDF = false;
        
        this.toastService.success(
          'PDF Generado Exitosamente', 
          'El archivo PDF se ha descargado con el formato profesional'
        );
      }, 2000);
      
    } catch (error) {
      this.isGeneratingPDF = false;
      this.toastService.error(
        'Error en Generación de PDF', 
        'Ocurrió un error al generar el archivo PDF. Por favor, intente nuevamente.'
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
        this.printWithElectron(printContent, safetyTimeout);
      } else {
        console.log('⚠️ API de Electron no disponible, usando fallback de navegador');
        this.printWithBrowser(printContent, safetyTimeout);
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
          Sistema de Apoyo y Asistencia Estudiantil - SAAE | Total de registros: ${this.registrosEstudiantes.length}
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

  private generatePDFDocument(): void {
    const doc = new jsPDF('l', 'mm', 'a4'); // Orientación horizontal para mejor aprovechamiento
    const pageWidth = doc.internal.pageSize.width;
    const pageHeight = doc.internal.pageSize.height;
    const margin = 15;
    
    // Configurar fuentes
    doc.setFont('helvetica');
    
    // Encabezado del documento
    this.addPDFHeader(doc, pageWidth, margin);
    
    let currentY = 40; // Posición Y inicial después del encabezado
    
    // Procesar cada registro de estudiante
    this.registrosEstudiantes.forEach((registro, index) => {
      // Verificar si necesitamos una nueva página
      if (currentY > pageHeight - 80) {
        doc.addPage();
        this.addPDFHeader(doc, pageWidth, margin);
        currentY = 40;
      }
      
      // Agregar información del estudiante
      currentY = this.addStudentSection(doc, registro, currentY, pageWidth, margin, index + 1);
      currentY += 15; // Espacio entre estudiantes
    });
    
    // Pie de página en la última página
    this.addPDFFooter(doc, pageHeight, pageWidth, margin);
    
    // Generar nombre de archivo y descargar
    const fecha = new Date();
    const fechaFormateada = this.formatDate(fecha);
    const horaFormateada = fecha.toTimeString().split(' ')[0].replace(/:/g, '-');
    const nombreArchivo = `reporte_apoyo_familiar_${fechaFormateada}_${horaFormateada}.pdf`;
    
    doc.save(nombreArchivo);
  }

  private addPDFHeader(doc: jsPDF, pageWidth: number, margin: number): void {
    // Título principal
    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.text('REPORTE DE APOYO FAMILIAR', pageWidth / 2, 20, { align: 'center' });
    
    // Subtítulo
    doc.setFontSize(12);
    doc.setFont('helvetica', 'normal');
    doc.text('Revisión Individual', pageWidth / 2, 28, { align: 'center' });
    
    // Fecha de generación
    doc.setFontSize(10);
    doc.text(`Generado el: ${new Date().toLocaleDateString('es-ES')} a las ${new Date().toLocaleTimeString('es-ES')}`, 
              pageWidth - margin, 20, { align: 'right' });
    
    // Línea separadora
    doc.setLineWidth(0.5);
    doc.line(margin, 33, pageWidth - margin, 33);
  }

  private addStudentSection(doc: jsPDF, registro: Partial<RegistroEstudiante>, startY: number, pageWidth: number, margin: number, numeroEstudiante: number): number {
    let currentY = startY;
    
    // Información básica del estudiante en un recuadro
    doc.setFillColor(240, 248, 255); // Azul muy claro
    doc.rect(margin, currentY, pageWidth - 2 * margin, 25, 'F');
    doc.setDrawColor(59, 130, 246); // Azul
    doc.rect(margin, currentY, pageWidth - 2 * margin, 25);
    
    // Título del estudiante
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(30, 58, 138); // Azul oscuro
    doc.text(`ESTUDIANTE ${numeroEstudiante}`, margin + 5, currentY + 8);
    
    // Información básica en dos columnas
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(0, 0, 0);
    
    const col1X = margin + 5;
    const col2X = pageWidth / 2 + 10;
    
    // Columna 1
    doc.text(`CI: ${registro.ci_estudiante || 'N/A'}`, col1X, currentY + 15);
    doc.text(`Total U.V.E.: ${registro.total_creditos || 0}`, col1X, currentY + 20);
    
    // Columna 2
    doc.text(`Nombre: ${registro.nombre_estudiante || 'N/A'}`, col2X, currentY + 15);
    doc.text(`Carrera: ${registro.carrera || 'N/A'}`, col2X, currentY + 20);
    
    currentY += 30;
    
    // Tabla manual de información financiera
    currentY = this.addFinancialTable(doc, registro, currentY, pageWidth, margin);
    
    // Información del plan de pago
    if (registro.plan_primer_pago) {
      doc.setFillColor(254, 249, 195); // Amarillo claro
      doc.rect(margin, currentY, pageWidth - 2 * margin, 20, 'F');
      doc.setDrawColor(245, 158, 11); // Amarillo
      doc.rect(margin, currentY, pageWidth - 2 * margin, 20);
      
      doc.setFontSize(11);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(146, 64, 14); // Amarillo oscuro
      doc.text('INFORMACIÓN DE PAGO REALIZADO POR DERECHO DE INSCRIPCIÓN', margin + 5, currentY + 8);
      
      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(0, 0, 0);
      doc.text(`Plan: ${registro.plan_primer_pago}`, margin + 5, currentY + 15);
      doc.text(`Monto: BOB. ${(registro.monto_primer_pago || 0).toFixed(2)}`, margin + 100, currentY + 15);
      doc.text(`Referencia: ${registro.referencia_primer_pago || 'N/A'}`, margin + 150, currentY + 15);
      
      currentY += 25;
    }
    
    return currentY;
  }

  private addFinancialTable(doc: jsPDF, registro: Partial<RegistroEstudiante>, startY: number, pageWidth: number, margin: number): number {
    let currentY = startY;
    const tableData = this.prepareStudentTableData(registro);
    
    // Configuración de la tabla
    const colWidths = [60, 40, 40, 40];
    const tableWidth = colWidths.reduce((sum, width) => sum + width, 0);
    const startX = margin + (pageWidth - 2 * margin - tableWidth) / 2;
    const rowHeight = 8;
    
    // Encabezado de la tabla
    doc.setFillColor(30, 58, 138); // Azul
    doc.rect(startX, currentY, tableWidth, rowHeight, 'F');
    doc.setDrawColor(30, 58, 138);
    doc.rect(startX, currentY, tableWidth, rowHeight);
    
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(255, 255, 255);
    
    const headers = ['Concepto', 'Plan Original', 'Plan con Descuento', 'Diferencia'];
    let colX = startX;
    
    headers.forEach((header, index) => {
      doc.text(header, colX + colWidths[index] / 2, currentY + 5, { align: 'center' });
      colX += colWidths[index];
    });
    
    currentY += rowHeight;
    
    // Filas de datos
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(0, 0, 0);
    
    tableData.forEach((row, rowIndex) => {
      // Alternar colores de fila
      if (rowIndex % 2 === 0) {
        doc.setFillColor(248, 250, 252); // Gris muy claro
        doc.rect(startX, currentY, tableWidth, rowHeight, 'F');
      }
      
      // Bordes de la fila
      doc.setDrawColor(200, 200, 200);
      doc.rect(startX, currentY, tableWidth, rowHeight);
      
      // Contenido de las celdas
      colX = startX;
      row.forEach((cell, cellIndex) => {
        const textAlign = cellIndex === 0 ? 'left' : 'right';
        const textX = cellIndex === 0 ? colX + 2 : colX + colWidths[cellIndex] - 2;
        
        // Color verde para las diferencias (última columna)
        if (cellIndex === 3) {
          doc.setTextColor(34, 197, 94);
        } else if (cellIndex === 0) {
          doc.setFont('helvetica', 'bold');
        } else {
          doc.setTextColor(0, 0, 0);
          doc.setFont('helvetica', 'normal');
        }
        
        doc.text(cell, textX, currentY + 5, { align: textAlign });
        colX += colWidths[cellIndex];
      });
      
      currentY += rowHeight;
      doc.setTextColor(0, 0, 0);
      doc.setFont('helvetica', 'normal');
    });
    
    return currentY + 10;
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

  private addPDFFooter(doc: jsPDF, pageHeight: number, pageWidth: number, margin: number): void {
    const footerY = pageHeight - 15;
    
    // Línea separadora
    doc.setLineWidth(0.3);
    doc.line(margin, footerY - 5, pageWidth - margin, footerY - 5);
    
    // Texto del pie
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100, 100, 100);
    
    // Izquierda: Sistema
    doc.text('Servicio Académico Administrativo Estudiantil - SAAE', margin, footerY);
    
    // Centro: Total de registros
    doc.text(`Total de hermanos: ${this.registrosEstudiantes.length}`, 
             pageWidth / 2, footerY, { align: 'center' });
    
    // Derecha: Número de página
    const pageCount = doc.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.text(`Página ${i} de ${pageCount}`, pageWidth - margin, footerY, { align: 'right' });
    }
  }

  // Método actualizado para abrir modal de configuración
  exportarExcel(): void {
    if (this.registrosEstudiantes.length === 0) {
      this.toastService.warning(
        'Sin Datos', 
        'No hay registros disponibles para exportar'
      );
      return;
    }
    
    this.showExportModal = true;
  }

  // Nuevo método para manejar el cierre del modal
  onExportModalClose(): void {
    this.showExportModal = false;
  }

  // Nuevo método para manejar la exportación con configuración
  onExportConfirmed(config: ExportConfig): void {
    this.showExportModal = false;
    this.performExcelExport(config);
  }

  // Método mejorado de exportación
  private performExcelExport(config: ExportConfig): void {
    this.isExporting = true;
    
    try {
      // Simular tiempo de procesamiento
      setTimeout(() => {
        const enabledColumns = config.columns.filter(col => col.enabled);
        
        // Crear datos para Excel basados en columnas seleccionadas
        const datosExcel = this.registrosEstudiantes.map(registro => {
          const fila: any = {};
          
          enabledColumns.forEach(column => {
            switch (column.key) {
              case 'ci_estudiante':
                fila[column.label] = registro.ci_estudiante || '';
                break;
              case 'nombre_estudiante':
                fila[column.label] = registro.nombre_estudiante || '';
                break;
              case 'carrera':
                fila[column.label] = registro.carrera || '';
                break;
              case 'total_creditos':
                fila[column.label] = registro.total_creditos || 0;
                break;
              case 'valor_credito':
                fila[column.label] = registro.valor_credito || 0;
                break;
              case 'credito_tecnologico':
                fila[column.label] = registro.credito_tecnologico || 0;
                break;
              case 'porcentaje_descuento':
                fila[column.label] = registro.porcentaje_descuento ? (registro.porcentaje_descuento * 100).toFixed(1) + '%' : '0%';
                break;
              case 'monto_primer_pago':
                fila[column.label] = registro.monto_primer_pago || 0;
                break;
              case 'plan_primer_pago':
                fila[column.label] = registro.plan_primer_pago || '';
                break;
              case 'referencia_primer_pago':
                fila[column.label] = registro.referencia_primer_pago || '';
                break;
              case 'total_semestre':
                fila[column.label] = registro.total_semestre || 0;
                break;
              case 'registrado':
                fila[column.label] = registro.registrado ? 'Sí' : 'No';
                break;
              case 'comentarios':
                fila[column.label] = registro.comentarios || '';
                break;
              // Campos calculados
              case 'derechos_academicos_originales':
                fila[column.label] = (registro.valor_credito || 0) * (registro.total_creditos || 0);
                break;
              case 'derechos_academicos_descuento':
                fila[column.label] = ((registro.valor_credito || 0) * (registro.total_creditos || 0)) * (1 - (registro.porcentaje_descuento || 0));
                break;
              case 'ahorro_descuento':
                fila[column.label] = ((registro.valor_credito || 0) * (registro.total_creditos || 0)) * (registro.porcentaje_descuento || 0);
                break;
              case 'saldo_semestre_original':
                fila[column.label] = (registro.total_semestre || 0) - (registro.monto_primer_pago || 0);
                break;
              case 'saldo_semestre_descuento':
                const saldoConDescuento = registro.porcentaje_descuento ? 
                  (((registro.valor_credito || 0) * (registro.total_creditos || 0)) * (1 - registro.porcentaje_descuento) + (registro.credito_tecnologico || 0) - (registro.monto_primer_pago || 0)) : 
                  ((registro.total_semestre || 0) - (registro.monto_primer_pago || 0));
                fila[column.label] = saldoConDescuento;
                break;
            }
          });
          
          return fila;
        });

        // Crear libro de trabajo
        const libro = XLSX.utils.book_new();
        
        // Crear hoja de trabajo principal
        const hoja = XLSX.utils.json_to_sheet(datosExcel);

        // Configurar anchos de columnas dinámicamente
        const anchosColumnas = enabledColumns.map(col => ({ wch: this.getColumnWidth(col.key) }));
        hoja['!cols'] = anchosColumnas;

        // Agregar hoja principal
        XLSX.utils.book_append_sheet(libro, hoja, 'Registros de Estudiantes');

        // Generar nombre de archivo con formato fijo DD/MM/YYYY
        const fecha = new Date();
        const fechaFormateada = this.formatDate(fecha);
        const horaFormateada = fecha.toTimeString().split(' ')[0].replace(/:/g, '-');
        const nombreArchivo = `${config.fileName}_${fechaFormateada}_${horaFormateada}.xlsx`;

        // Exportar archivo
        XLSX.writeFile(libro, nombreArchivo);
        
        this.isExporting = false;
        
        this.toastService.success(
          'Exportación Completada', 
          `Archivo "${nombreArchivo}" descargado exitosamente con ${datosExcel.length} registros y ${enabledColumns.length} columnas`,
          3000
        );
        
      }, 1500);
      
    } catch (error) {
      this.isExporting = false;
      this.toastService.error(
        'Error en Exportación', 
        'Ocurrió un error al generar el archivo Excel. Por favor, intente nuevamente.'
      );
      console.error('Error exportando Excel:', error);
    }
  }

  private formatCurrency(value: number, format: string): string | number {
    // Siempre retornar solo el número
    return value;
  }

  private formatDate(date: Date): string {
    // Formato fijo DD/MM/YYYY
    const day = date.getDate().toString().padStart(2, '0');
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const year = date.getFullYear();
    return `${day}-${month}-${year}`;
  }

  private getColumnWidth(key: string): number {
    const widths: { [key: string]: number } = {
      'ci_estudiante': 18,
      'nombre_estudiante': 35,
      'carrera': 30,
      'total_creditos': 15,
      'valor_credito': 18,
      'credito_tecnologico': 20,
      'porcentaje_descuento': 20,
      'monto_primer_pago': 20,
      'plan_primer_pago': 25,
      'referencia_primer_pago': 40,
      'total_semestre': 18,
      'registrado': 12,
      'comentarios': 30,
      'derechos_academicos_originales': 28,
      'derechos_academicos_descuento': 30,
      'ahorro_descuento': 20,
      'saldo_semestre_original': 25,
      'saldo_semestre_descuento': 28
    };
    return widths[key] || 20;
  }
}
