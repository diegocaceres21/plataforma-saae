import { Injectable } from '@angular/core';
import { RegistroEstudiante } from '../interfaces/registro-estudiante';
import { ExportConfig, ExportColumn } from '../../shared/interfaces/export-config';
import { ToastService } from '../../shared/servicios/toast';
import { BeneficioService } from './beneficio.service';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import { LOGO_BASE64 } from '../../shared/constantes/logo-base64';

// Logo Base64 centralizado

@Injectable({
  providedIn: 'root'
})
export class ExportService {

  constructor(
    private toastService: ToastService,
    private beneficioService: BeneficioService
  ) {}

  // Helper para formatear moneda boliviana
  private formatCurrency(value: number): string {
    return `Bs. ${value.toLocaleString('es-BO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }

  // Helper para formatear saldo (negativos entre paréntesis)
  private formatBalance(value: number): string {
    const absoluteValue = Math.abs(value);
    const formattedValue = `Bs. ${absoluteValue.toLocaleString('es-BO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    return value < 0 ? `(${formattedValue})` : formattedValue;
  }

  // Obtener nombre del beneficio
  private getBeneficioNombre(id?: string): string {
    if (!id) return 'N/A';
    const beneficio = this.beneficioService.currentData.find(b => b.id === id);
    return beneficio?.nombre || 'N/A';
  }

  // Configuración por defecto de columnas para exportación
  getDefaultColumns(): ExportColumn[] {
    return [
      { key: 'ci_estudiante', label: 'Carnet de Identidad', enabled: true },
      { key: 'nombre_estudiante', label: 'Nombre Completo', enabled: true },
      { key: 'carrera', label: 'Carrera', enabled: true },
      { key: 'total_creditos', label: 'Total U.V.E.', enabled: true },
      { key: 'valor_credito', label: 'Valor por U.V.E.', enabled: true },
      { key: 'porcentaje_descuento', label: 'Porcentaje Descuento', enabled: true },
      { key: 'plan_primer_pago', label: 'Plan de Pago', enabled: true },
      { key: 'referencia_primer_pago', label: 'Referencia de Pago', enabled: true },
      { key: 'registrado', label: 'Registrado', enabled: false },
      { key: 'comentarios', label: 'Comentarios', enabled: false },
      { key: 'derechos_academicos_originales', label: 'Derechos Académicos Originales', enabled: false, isCalculated: true },
      { key: 'derechos_academicos_descuento', label: 'Derechos Académicos con Descuento', enabled: false, isCalculated: true },
      { key: 'credito_tecnologico', label: 'Crédito Tecnológico', enabled: false, isCalculated: true },
      { key: 'total_semestre', label: 'Total Semestre', enabled: false, isCalculated: true },
      { key: 'total_semestre_descuento', label: 'Total Semestre con Descuento', enabled: false, isCalculated: true },
      { key: 'ahorro_descuento', label: 'Ahorro por Descuento', enabled: false, isCalculated: true },
      { key: 'monto_primer_pago', label: 'Monto Primer Pago', enabled: false, isCalculated: true },
      { key: 'pagos_realizados', label: 'Pagos Realizados', enabled: false, isCalculated: true },
      { key: 'pago_credito_tecnologico', label: 'Pago Crédito Tecnológico', enabled: false, isCalculated: true },
      { key: 'saldo_semestre_original', label: 'Saldo Semestre sin Descuento', enabled: false, isCalculated: true },
      { key: 'saldo_semestre_descuento', label: 'Saldo Semestre con Descuento', enabled: false, isCalculated: true }
    ];
  }

  // Exportación a PDF (vista individual)
  exportToPDF(registros: Partial<RegistroEstudiante>[], documentTitle: string = 'REPORTE DE APOYO FAMILIAR'): Promise<boolean> {
    return new Promise((resolve) => {
      if (registros.length === 0) {
        this.toastService.warning(
          'Sin Datos',
          'No hay registros disponibles para exportar'
        );
        resolve(false);
        return;
      }

      try {
        // Simular tiempo de procesamiento
        setTimeout(() => {
          this.generatePDFDocument(registros, documentTitle);

          this.toastService.success(
            'PDF Generado Exitosamente',
            'El archivo PDF se ha descargado con el formato profesional',
            3000
          );
          resolve(true);
        }, 2000);

      } catch (error) {
        this.toastService.error(
          'Error en Generación de PDF',
          'Ocurrió un error al generar el archivo PDF. Por favor, intente nuevamente.'
        );
        resolve(false);
      }
    });
  }

  // Exportación a PDF (listado general con formato de tabla)
  exportListToPDF(
    registros: Partial<RegistroEstudiante>[], 
    getNombreGestion: (id: string) => string,
    formatearFecha: (fecha: string) => string
  ): Promise<boolean> {
    return new Promise((resolve) => {
      if (registros.length === 0) {
        this.toastService.warning(
          'Sin Datos',
          'No hay registros disponibles para exportar'
        );
        resolve(false);
        return;
      }

      try {
        // Simular tiempo de procesamiento
        setTimeout(() => {
          this.generateListPDFDocument(registros, getNombreGestion, formatearFecha);

          this.toastService.success(
            'PDF Generado Exitosamente',
            'El listado general ha sido exportado correctamente',
            3000
          );
          resolve(true);
        }, 2000);

      } catch (error) {
        this.toastService.error(
          'Error en Generación de PDF',
          'Ocurrió un error al generar el archivo PDF. Por favor, intente nuevamente.'
        );
        console.error('Error exportando PDF:', error);
        resolve(false);
      }
    });
  }

  // Exportación a PDF (detalle de solicitud individual)
  exportDetailToPDF(
    registros: Partial<RegistroEstudiante>[],
    solicitudId: string,
    gestionNombre: string,
    getNombreGestion: (id: string) => string,
    formatearFecha: (fecha: string) => string
  ): Promise<boolean> {
    return new Promise((resolve) => {
      if (registros.length === 0) {
        this.toastService.warning(
          'Sin Datos',
          'No hay datos seleccionados para exportar'
        );
        resolve(false);
        return;
      }

      try {
        // Simular tiempo de procesamiento
        setTimeout(() => {
          this.generateDetailPDFDocument(registros, solicitudId, gestionNombre, getNombreGestion);

          this.toastService.success(
            'PDF Generado',
            'Detalle de solicitud exportado correctamente',
            3000
          );
          resolve(true);
        }, 2000);

      } catch (error) {
        this.toastService.error(
          'Error en Generación de PDF',
          'Ocurrió un error al generar el archivo PDF. Por favor, intente nuevamente.'
        );
        console.error('Error exportando PDF de detalle:', error);
        resolve(false);
      }
    });
  }

  // Exportación a Excel
  exportToExcel(registros: Partial<RegistroEstudiante>[], config: ExportConfig): Promise<boolean> {
    return new Promise((resolve) => {
      if (registros.length === 0) {
        this.toastService.warning(
          'Sin Datos',
          'No hay registros disponibles para exportar'
        );
        resolve(false);
        return;
      }

      try {
        // Simular tiempo de procesamiento
        setTimeout(() => {
          this.performExcelExport(registros, config);
          resolve(true);
        }, 1500);

      } catch (error) {
        this.toastService.error(
          'Error en Exportación',
          'Ocurrió un error al generar el archivo Excel. Por favor, intente nuevamente.'
        );
        console.error('Error exportando Excel:', error);
        resolve(false);
      }
    });
  }

  private generatePDFDocument(registros: Partial<RegistroEstudiante>[], documentTitle: string): void {
    const doc = new jsPDF('l', 'mm', 'a4'); // Orientación horizontal para mejor aprovechamiento
    const pageWidth = doc.internal.pageSize.width;
    const pageHeight = doc.internal.pageSize.height;
    const margin = 15;

    // Configurar fuentes
    doc.setFont('helvetica');

    // Encabezado del documento
    this.addPDFHeader(doc, pageWidth, margin, documentTitle);

    let currentY = 40; // Posición Y inicial después del encabezado

    // Procesar cada registro de estudiante
    registros.forEach((registro, index) => {
      // Verificar si necesitamos una nueva página
      if (currentY > pageHeight - 80) {
        doc.addPage();
        this.addPDFHeader(doc, pageWidth, margin, documentTitle);
        currentY = 40;
      }

      // Agregar información del estudiante
      currentY = this.addStudentSection(doc, registro, currentY, pageWidth, margin, index + 1);
      currentY += 15; // Espacio entre estudiantes
    });

    // Pie de página en la última página
    this.addPDFFooter(doc, pageHeight, pageWidth, margin, registros.length);

    // Generar nombre de archivo y descargar
    const fecha = new Date();
    const fechaFormateada = this.formatDate(fecha);
    const horaFormateada = fecha.toTimeString().split(' ')[0].replace(/:/g, '-');
    const nombreArchivo = `reporte_apoyo_familiar_${fechaFormateada}_${horaFormateada}.pdf`;

    doc.save(nombreArchivo);
  }

  private generateListPDFDocument(
    registros: Partial<RegistroEstudiante>[], 
    getNombreGestion: (id: string) => string,
    formatearFecha: (fecha: string) => string
  ): void {
    const doc = new jsPDF('l', 'mm', 'a4'); // Orientación horizontal
    const pageWidth = doc.internal.pageSize.width;
    const pageHeight = doc.internal.pageSize.height;
    const margin = 15;

    // Encabezado principal
    this.addListPDFHeader(doc, pageWidth, margin);

    let currentY = 45;

    // Tabla de registros
    const tableData = this.prepareListTableData(registros, getNombreGestion, formatearFecha);
    
    // Configuración de columnas para la tabla
    const headers = ['#', 'Gestión', 'CI', 'Estudiante', 'Carrera', 'Beneficio', 'UVE', 'Desc.', 'Plan', 'Pagos', 'Saldo'];
    const colWidths = [8, 20, 22, 40, 45, 32, 12, 12, 25, 20, 20];
    const rowHeight = 7;

    // Encabezado de tabla
    doc.setFillColor(30, 58, 138);
    doc.setDrawColor(30, 58, 138);
    
    let headerX = margin;
    doc.rect(headerX, currentY, colWidths.reduce((a, b) => a + b, 0), rowHeight, 'F');
    
    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(255, 255, 255);

    headers.forEach((header, index) => {
      doc.text(header, headerX + colWidths[index] / 2, currentY + 5, { align: 'center' });
      headerX += colWidths[index];
    });

    currentY += rowHeight;

    // Filas de datos
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(0, 0, 0);

    tableData.forEach((row, rowIndex) => {
      // Verificar si necesitamos nueva página
      if (currentY > pageHeight - 30) {
        doc.addPage();
        this.addListPDFHeader(doc, pageWidth, margin);
        currentY = 45;

        // Re-dibujar encabezado de tabla
        headerX = margin;
        doc.setFillColor(30, 58, 138);
        doc.rect(headerX, currentY, colWidths.reduce((a, b) => a + b, 0), rowHeight, 'F');
        
        doc.setFontSize(8);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(255, 255, 255);

        headers.forEach((header, index) => {
          doc.text(header, headerX + colWidths[index] / 2, currentY + 5, { align: 'center' });
          headerX += colWidths[index];
        });

        currentY += rowHeight;
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(0, 0, 0);
      }

      // Alternar colores de fila
      if (rowIndex % 2 === 0) {
        doc.setFillColor(248, 250, 252);
        doc.rect(margin, currentY, colWidths.reduce((a, b) => a + b, 0), rowHeight, 'F');
      }

      // Bordes
      doc.setDrawColor(200, 200, 200);
      doc.rect(margin, currentY, colWidths.reduce((a, b) => a + b, 0), rowHeight);

      // Contenido de celdas
      let cellX = margin;
      doc.setFontSize(7);

      row.forEach((cellValue, cellIndex) => {
        const textAlign = cellIndex === 0 || cellIndex === 6 || cellIndex === 7 ? 'center' : 
                         cellIndex === 9 || cellIndex === 10 ? 'right' : 'left';
        const xPosition = textAlign === 'center' 
          ? cellX + colWidths[cellIndex] / 2 
          : textAlign === 'right'
          ? cellX + colWidths[cellIndex] - 2
          : cellX + 2;

        // Truncar texto largo
        let displayText = cellValue.toString();
        const maxChars = cellIndex === 3 ? 25 : cellIndex === 4 ? 28 : cellIndex === 5 ? 20 : 100;
        if (displayText.length > maxChars) {
          displayText = displayText.substring(0, maxChars - 3) + '...';
        }

        // Aplicar negrillas si es la columna de Saldo (índice 10) y el valor es negativo (contiene paréntesis)
        if (cellIndex === 10 && displayText.includes('(')) {
          doc.setFont('helvetica', 'bold');
        } else {
          doc.setFont('helvetica', 'normal');
        }

        doc.text(displayText, xPosition, currentY + 4.5, { align: textAlign });
        cellX += colWidths[cellIndex];
      });

      currentY += rowHeight;
    });

    // Resumen al final
    this.addListPDFFooter(doc, pageHeight, margin, registros.length);

    // Generar nombre de archivo
    const fecha = new Date();
    const fechaFormateada = this.formatDate(fecha);
    const horaFormateada = fecha.toTimeString().split(' ')[0].replace(/:/g, '-');
    const nombreArchivo = `listado_general_registros_${fechaFormateada}_${horaFormateada}.pdf`;

    doc.save(nombreArchivo);
  }

  private addListPDFHeader(doc: jsPDF, pageWidth: number, margin: number): void {
    const img = new Image();
    img.src = "logo-ucb-cba.png";
    
    // Logo
    const logoWidth = 35;
    const logoHeight = 22;
    const logoX = 12;
    const logoY = 3;
    
    try {
      doc.addImage(img, 'PNG', logoX, logoY, logoWidth, logoHeight);
    } catch {
      // continuar aunque falle el logo
    }

    const textCenterX = pageWidth / 2 + logoWidth / 4;

    // Título
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(0, 0, 0);
    doc.text('REPORTE GENERAL - APOYOS, BECAS E INCENTIVOS', textCenterX, 14, { align: 'center' });

    // Subtítulo
    doc.setFontSize(11);
    doc.setFont('helvetica', 'normal');
    doc.text('Servicio Académico Administrativo Estudiantil', textCenterX, 20, { align: 'center' });

    // Fecha de generación
    doc.setFontSize(9);
    doc.text(
      `Generado el: ${new Date().toLocaleDateString('es-ES')} a las ${new Date().toLocaleTimeString('es-ES')}`,
      pageWidth - margin, 
      20, 
      { align: 'right' }
    );

    // Línea separadora
    doc.setLineWidth(0.5);
    doc.setDrawColor(100, 100, 100);
    doc.line(margin, 28, pageWidth - margin, 28);
  }

  private prepareListTableData(
    registros: Partial<RegistroEstudiante>[], 
    getNombreGestion: (id: string) => string,
    formatearFecha: (fecha: string) => string
  ): string[][] {
    return registros.map((registro, index) => {
      // Calcular derechos académicos con descuento (misma lógica que payment-plans-display)
      const creditosConDescuento = registro.creditos_descuento || registro.total_creditos || 0;
      const creditosSinDescuento = (registro.total_creditos || 0) - creditosConDescuento;
      const derechosAcademicosConDescuento = 
        creditosConDescuento * (registro.valor_credito || 0) * (1 - (registro.porcentaje_descuento || 0)) +
        creditosSinDescuento * (registro.valor_credito || 0);
      
      // El crédito tecnológico no se aplica cuando el descuento es 100%
      const creditoTecnologicoConDescuento = (registro.porcentaje_descuento !== 1) ? (registro.credito_tecnologico || 0) : 0;
      const totalConDescuento = derechosAcademicosConDescuento + creditoTecnologicoConDescuento;

      // Calcular pagos realizados (D.A. + C.T.)
      const pagosRealizados = registro.pagos_realizados || 0;
      const pagoCreditoTecnologico = registro.pago_credito_tecnologico ? (registro.credito_tecnologico || 0) : 0;
      const totalPagos = pagosRealizados + pagoCreditoTecnologico;

      // Calcular saldo semestre con descuento
      const montoPrimerPago = registro.monto_primer_pago || 0;
      const saldoConDescuento = totalConDescuento - montoPrimerPago - totalPagos;

      return [
        (index + 1).toString(),
        getNombreGestion(registro.id_gestion || ''),
        registro.ci_estudiante || 'N/A',
        registro.nombre_estudiante || 'N/A',
        registro.carrera || 'N/A',
        this.getBeneficioNombre(registro.id_beneficio),
        (registro.total_creditos || 0).toString(),
        `${((registro.porcentaje_descuento || 0) * 100).toFixed(0)}%`,
        registro.plan_primer_pago || 'N/A',
        this.formatCurrency(totalPagos),
        this.formatBalance(saldoConDescuento)
      ];
    });
  }

  private addListPDFFooter(doc: jsPDF, pageHeight: number, margin: number, totalRegistros: number): void {
    doc.setFontSize(8);
    doc.setFont('helvetica', 'italic');
    doc.setTextColor(100, 100, 100);
    
    doc.text(
      `Total de registros: ${totalRegistros} | Generado por SAAE - Sistema de Apoyo Académico Estudiantil`,
      doc.internal.pageSize.width / 2,
      pageHeight - 10,
      { align: 'center' }
    );
  }

  private generateDetailPDFDocument(
    registros: Partial<RegistroEstudiante>[],
    solicitudId: string,
    gestionNombre: string,
    getNombreGestion: (id: string) => string
  ): void {
    const doc = new jsPDF('l', 'mm', 'a4');
    const pageWidth = doc.internal.pageSize.width;
    const pageHeight = doc.internal.pageSize.height;
    const margin = 15;

    // Encabezado
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(18);
    doc.text('DETALLE DE SOLICITUD - APOYO FAMILIAR', pageWidth / 2, 20, { align: 'center' });

    doc.setFontSize(12);
    doc.setFont('helvetica', 'normal');
    const fecha = new Date().toLocaleDateString('es-ES');
    doc.text(`ID Solicitud: ${solicitudId.slice(-12)}`, margin, 35);
    doc.text(`Fecha de generación: ${fecha}`, pageWidth - margin, 35, { align: 'right' });
    doc.text(`Gestión: ${gestionNombre}`, margin, 42);
    doc.text(`Total estudiantes: ${registros.length}`, pageWidth - margin, 42, { align: 'right' });

    // Línea separadora
    doc.setLineWidth(0.5);
    doc.line(margin, 48, pageWidth - margin, 48);

    let currentY = 60;

    // Procesar cada estudiante
    registros.forEach((registro, index) => {
      if (currentY > 180) {
        doc.addPage();
        currentY = 20;
      }

      currentY = this.addDetailStudentSectionInPDF(doc, registro, currentY, pageWidth, margin, index + 1);
      currentY += 10;
    });

    // Generar y descargar
    const solicitudIdShort = solicitudId.slice(-8);
    const fechaFormateada = this.formatDate(new Date());
    const nombreArchivo = `detalle_solicitud_${solicitudIdShort}_${fechaFormateada}.pdf`;

    doc.save(nombreArchivo);
  }

  private addDetailStudentSectionInPDF(
    doc: jsPDF,
    registro: Partial<RegistroEstudiante>,
    startY: number,
    pageWidth: number,
    margin: number,
    numeroEstudiante: number
  ): number {
    let currentY = startY;

    // Información del estudiante
    doc.setFillColor(240, 248, 255);
    doc.rect(margin, currentY, pageWidth - 2 * margin, 24, 'F');
    doc.setDrawColor(59, 130, 246);
    doc.rect(margin, currentY, pageWidth - 2 * margin, 24);

    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(30, 58, 138);
    doc.text(`ESTUDIANTE ${numeroEstudiante}`, margin + 5, currentY + 8);

    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(0, 0, 0);

    const col1X = margin + 5;
    const col2X = pageWidth / 2;

    doc.text(`CI: ${registro.ci_estudiante || 'N/A'}`, col1X, currentY + 14);
    doc.text(`Nombre: ${registro.nombre_estudiante || 'N/A'}`, col2X, currentY + 14);
    doc.text(`U.V.E.: ${registro.total_creditos || 0}`, col1X, currentY + 18);
    doc.text(`Carrera: ${registro.carrera || 'N/A'}`, col2X, currentY + 18);
    doc.text(`Tipo de Beneficio: ${this.getBeneficioNombre(registro.id_beneficio).toUpperCase()}`, col1X, currentY + 22);

    return currentY + 29;
  }

  private addPDFHeader(doc: jsPDF, pageWidth: number, margin: number, title: string): void {
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

    // Ajustar centro óptico considerando el espacio ocupado por el logo
    const textCenterX = pageWidth / 2 + logoWidth / 4; // pequeño corrimiento a la derecha para equilibrio visual

    // Título principal
    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.text(title, textCenterX, 18, { align: 'center' });

    // Subtítulo
    doc.setFontSize(12);
    doc.setFont('helvetica', 'normal');
    doc.text('Servicio Académico Administrativo Estudiantil', textCenterX, 26, { align: 'center' });

    // Fecha de generación a la derecha
    doc.setFontSize(10);
    doc.text(`Generado el: ${new Date().toLocaleDateString('es-ES')} a las ${new Date().toLocaleTimeString('es-ES')}`,
      pageWidth - margin, 8, { align: 'right' });

    // Línea separadora (debajo del bloque del logo y textos)
    doc.setLineWidth(0.5);
    doc.line(margin, 33, pageWidth - margin, 33);
  }

  private addStudentSection(doc: jsPDF, registro: Partial<RegistroEstudiante>, startY: number, pageWidth: number, margin: number, numeroEstudiante: number): number {
    let currentY = startY;

    // Información básica del estudiante en un recuadro
    doc.setFillColor(240, 248, 255); // Azul muy claro
    // Aumentamos la altura del recuadro para incluir una tercera línea (descuento y beneficio)
    const studentBoxHeight = 30;
    doc.rect(margin, currentY, pageWidth - 2 * margin, studentBoxHeight, 'F');
    doc.setDrawColor(59, 130, 246); // Azul
    doc.rect(margin, currentY, pageWidth - 2 * margin, studentBoxHeight);

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
    const descuentoPct = (((registro.porcentaje_descuento || 0) * 100).toFixed(1)) + '%';
    doc.text(`Descuento: ${descuentoPct}`, col1X, currentY + 25);

    // Columna 2
    doc.text(`Nombre: ${registro.nombre_estudiante || 'N/A'}`, col2X, currentY + 15);
    doc.text(`Carrera: ${registro.carrera || 'N/A'}`, col2X, currentY + 20);
    doc.text(`Tipo de Beneficio: ${this.getBeneficioNombre(registro.id_beneficio).toUpperCase()}`, col2X, currentY + 25);

    // Dejamos un pequeño margen debajo del recuadro
    currentY += studentBoxHeight + 5;

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
      doc.text(`Monto: ${this.formatCurrency(registro.monto_primer_pago || 0)}`, margin + 100, currentY + 15);
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
      // Línea separadora más gruesa antes de "Derecho de Inscripción" (índice 3)
      if (rowIndex === 3) {
        doc.setDrawColor(30, 58, 138); // Azul oscuro
        doc.setLineWidth(1);
        doc.line(startX, currentY, startX + tableWidth, currentY);
        doc.setLineWidth(0.2); // Restaurar grosor normal
        currentY += 2; // Pequeño espacio adicional
      }

      // Línea separadora más gruesa antes de "Saldo Semestre" (índice 6)
      if (rowIndex === 6) {
        doc.setDrawColor(30, 58, 138); // Azul oscuro
        doc.setLineWidth(1);
        doc.line(startX, currentY, startX + tableWidth, currentY);
        doc.setLineWidth(0.2); // Restaurar grosor normal
        currentY += 2; // Pequeño espacio adicional
      }

      // Alternar colores de fila
      if (rowIndex % 2 === 0) {
        doc.setFillColor(248, 250, 252); // Gris muy claro
        doc.rect(startX, currentY, tableWidth, rowHeight, 'F');
      }

      // Bordes de la fila
      doc.setDrawColor(200, 200, 200);
      doc.rect(startX, currentY, tableWidth, rowHeight);

      // Contenido de las celdas
      let cellX = startX;
      row.forEach((cellValue, cellIndex) => {
        const textAlign = cellIndex === 0 ? 'left' : 'right';
        const xPosition = textAlign === 'left' ? cellX + 2 : cellX + colWidths[cellIndex] - 2;

        doc.setFontSize(8);
        
        // Aplicar estilos según la columna
        if (cellIndex === 2) {
          // Columna "Plan con Descuento" en negrillas
          doc.setTextColor(0, 0, 0);
          doc.setFont('helvetica', 'bold');
        } else if (cellIndex === 3 && parseFloat(cellValue.toString()) > 0) {
          // Columna "Diferencia" en verde y negrillas si es positiva
          doc.setTextColor(5, 150, 105);
          doc.setFont('helvetica', 'bold');
        } else {
          // Resto de columnas en normal
          doc.setTextColor(0, 0, 0);
          doc.setFont('helvetica', 'normal');
        }

        doc.text(cellValue.toString(), xPosition, currentY + 5, { align: textAlign });
        cellX += colWidths[cellIndex];
      });

      currentY += rowHeight;
    });

    return currentY + 5;
  }

  private addPDFFooter(doc: jsPDF, pageHeight: number, pageWidth: number, margin: number, totalRegistros: number): void {
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100, 100, 100);
    doc.text(`Servicio Académico Administrativo Estudiantil - SAAE | Total de registros: ${totalRegistros}`,
              pageWidth / 2, pageHeight - 10, { align: 'center' });
  }

  private prepareStudentTableData(registro: Partial<RegistroEstudiante>): string[][] {
    // Cálculos originales
    const derechosAcademicosOriginales = (registro.valor_credito || 0) * (registro.total_creditos || 0);
    const creditoTecnologico = registro.credito_tecnologico || 0;
    const totalOriginal = registro.total_semestre || 0;
    const montoPrimerPago = registro.monto_primer_pago || 0;
    const pagosRealizados = registro.pagos_realizados || 0;
    const pagoCredito = (registro.pago_credito_tecnologico ? creditoTecnologico : 0);

    // Cálculos con descuento (usando la misma lógica que payment-plans-display)
    const creditosConDescuento = registro.creditos_descuento || registro.total_creditos || 0;
    const creditosSinDescuento = (registro.total_creditos || 0) - creditosConDescuento;
    const derechosAcademicosConDescuento = 
      creditosConDescuento * (registro.valor_credito || 0) * (1 - (registro.porcentaje_descuento || 0)) +
      creditosSinDescuento * (registro.valor_credito || 0);
    
    // El crédito tecnológico no se aplica cuando el descuento es 100%
    const creditoTecnologicoConDescuento = (registro.porcentaje_descuento !== 1) ? creditoTecnologico : 0;
    const totalConDescuento = derechosAcademicosConDescuento + creditoTecnologicoConDescuento;

    // Saldos considerando pagos realizados y crédito tecnológico pagado
    const saldoOriginal = totalOriginal - montoPrimerPago - pagosRealizados - pagoCredito;
    const saldoConDescuento = totalConDescuento - montoPrimerPago - pagosRealizados - pagoCredito;

    return [
      [
        'Derechos Académicos',
        this.formatCurrency(derechosAcademicosOriginales),
        this.formatCurrency(derechosAcademicosConDescuento),
        this.formatCurrency(derechosAcademicosOriginales - derechosAcademicosConDescuento)
      ],
      [
        'Crédito Tecnológico',
        this.formatCurrency(creditoTecnologico),
        this.formatCurrency(creditoTecnologicoConDescuento),
        this.formatCurrency(creditoTecnologico - creditoTecnologicoConDescuento)
      ],
      [
        'Total Semestre',
        this.formatCurrency(totalOriginal),
        this.formatCurrency(totalConDescuento),
        this.formatCurrency(totalOriginal - totalConDescuento)
      ],
      [
        'Derecho de Inscripción',
        `(${this.formatCurrency(montoPrimerPago)})`,
        `(${this.formatCurrency(montoPrimerPago)})`,
        this.formatCurrency(0)
      ],
      [
        'Pagos Realizados (D.A.)',
        `(${this.formatCurrency(pagosRealizados)})`,
        `(${this.formatCurrency(pagosRealizados)})`,
        this.formatCurrency(0)
      ],
      [
        'Pago Crédito Tecnológico',
        `(${this.formatCurrency(pagoCredito)})`,
        `(${this.formatCurrency(pagoCredito)})`,
        this.formatCurrency(0)
      ],
      [
        'Saldo Semestre',
        this.formatCurrency(saldoOriginal),
        this.formatCurrency(saldoConDescuento),
        this.formatCurrency(saldoOriginal - saldoConDescuento)
      ]
    ];
  }

  private performExcelExport(registros: Partial<RegistroEstudiante>[], config: ExportConfig): void {
    const enabledColumns = config.columns.filter(col => col.enabled);

    // Crear datos para Excel basados en columnas seleccionadas
    const datosExcel = registros.map(registro => {
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
          case 'porcentaje_descuento':
            fila[column.label] = registro.porcentaje_descuento ? (registro.porcentaje_descuento * 100).toFixed(1) + '%' : '0%';
            break;
          case 'plan_primer_pago':
            fila[column.label] = registro.plan_primer_pago || '';
            break;
          case 'referencia_primer_pago':
            fila[column.label] = registro.referencia_primer_pago || '';
            break;
          case 'registrado':
            fila[column.label] = registro.registrado ? 'Sí' : 'No';
            break;
          case 'comentarios':
            fila[column.label] = registro.comentarios || '';
            break;
          // Campos calculados (misma lógica que payment-plans-display)
          case 'derechos_academicos_originales':
            fila[column.label] = (registro.valor_credito || 0) * (registro.total_creditos || 0);
            break;
          case 'derechos_academicos_descuento':
            const creditosConDescuento = registro.creditos_descuento || registro.total_creditos || 0;
            const creditosSinDescuento = (registro.total_creditos || 0) - creditosConDescuento;
            fila[column.label] = creditosConDescuento * (registro.valor_credito || 0) * (1 - (registro.porcentaje_descuento || 0)) + 
                                 creditosSinDescuento * (registro.valor_credito || 0);
            break;
          case 'credito_tecnologico':
            // El crédito tecnológico no se aplica cuando el descuento es 100%
            fila[column.label] = (registro.porcentaje_descuento !== 1) ? (registro.credito_tecnologico || 0) : 0;
            break;
          case 'total_semestre':
            fila[column.label] = registro.total_semestre || 0;
            break;
          case 'total_semestre_descuento':
            const creditosConDesc2 = registro.creditos_descuento || registro.total_creditos || 0;
            const creditosSinDesc2 = (registro.total_creditos || 0) - creditosConDesc2;
            const derechosAcadConDesc2 = creditosConDesc2 * (registro.valor_credito || 0) * (1 - (registro.porcentaje_descuento || 0)) + 
                                         creditosSinDesc2 * (registro.valor_credito || 0);
            const creditoTecnologicoConDesc = (registro.porcentaje_descuento !== 1) ? (registro.credito_tecnologico || 0) : 0;
            fila[column.label] = derechosAcadConDesc2 + creditoTecnologicoConDesc;
            break;
          case 'ahorro_descuento':
            const derechosOriginales = (registro.valor_credito || 0) * (registro.total_creditos || 0);
            const creditosDesc = registro.creditos_descuento || registro.total_creditos || 0;
            const creditosSinDesc = (registro.total_creditos || 0) - creditosDesc;
            const derechosConDesc = creditosDesc * (registro.valor_credito || 0) * (1 - (registro.porcentaje_descuento || 0)) + 
                                    creditosSinDesc * (registro.valor_credito || 0);
            fila[column.label] = derechosOriginales - derechosConDesc;
            break;
          case 'monto_primer_pago':
            fila[column.label] = registro.monto_primer_pago || 0;
            break;
          case 'pagos_realizados':
            fila[column.label] = registro.pagos_realizados || 0;
            break;
          case 'pago_credito_tecnologico':
            fila[column.label] = registro.pago_credito_tecnologico ? (registro.credito_tecnologico || 0) : 0;
            break;
          case 'saldo_semestre_original':
            const totalOriginal = registro.total_semestre || 0;
            const pagosRealizadosOrig = registro.pagos_realizados || 0;
            const pagoCreditoOrig = registro.pago_credito_tecnologico ? (registro.credito_tecnologico || 0) : 0;
            fila[column.label] = totalOriginal - (registro.monto_primer_pago || 0) - pagosRealizadosOrig - pagoCreditoOrig;
            break;
          case 'saldo_semestre_descuento':
            const credConDesc = registro.creditos_descuento || registro.total_creditos || 0;
            const credSinDesc = (registro.total_creditos || 0) - credConDesc;
            const derAcadConDesc = credConDesc * (registro.valor_credito || 0) * (1 - (registro.porcentaje_descuento || 0)) + 
                                   credSinDesc * (registro.valor_credito || 0);
            const credTecnologico = (registro.porcentaje_descuento !== 1) ? (registro.credito_tecnologico || 0) : 0;
            const totalConDesc = derAcadConDesc + credTecnologico;
            const pagosRealizadosDesc = registro.pagos_realizados || 0;
            const pagoCreditoDesc = registro.pago_credito_tecnologico ? (registro.credito_tecnologico || 0) : 0;
            fila[column.label] = totalConDesc - (registro.monto_primer_pago || 0) - pagosRealizadosDesc - pagoCreditoDesc;
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

    this.toastService.success(
      'Exportación Completada',
      `Archivo "${nombreArchivo}" descargado exitosamente con ${datosExcel.length} registros y ${enabledColumns.length} columnas`,
      3000
    );
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
      'porcentaje_descuento': 20,
      'plan_primer_pago': 25,
      'referencia_primer_pago': 40,
      'registrado': 12,
      'comentarios': 30,
      'derechos_academicos_originales': 30,
      'derechos_academicos_descuento': 32,
      'credito_tecnologico': 20,
      'total_semestre': 20,
      'total_semestre_descuento': 28,
      'ahorro_descuento': 20,
      'monto_primer_pago': 20,
      'pagos_realizados': 20,
      'pago_credito_tecnologico': 25,
      'saldo_semestre_original': 28,
      'saldo_semestre_descuento': 30
    };
    return widths[key] || 20;
  }
}
