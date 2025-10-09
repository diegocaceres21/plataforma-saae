import { Injectable } from '@angular/core';
import { RegistroEstudiante } from '../interfaces/registro-estudiante';
import { ExportConfig, ExportColumn } from '../../shared/interfaces/export-config';
import { ToastService } from '../../shared/servicios/toast';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import { LOGO_BASE64 } from '../../shared/constantes/logo-base64';

// Logo Base64 centralizado

@Injectable({
  providedIn: 'root'
})
export class ExportService {

  constructor(private toastService: ToastService) {}

  // Configuración por defecto de columnas para exportación
  getDefaultColumns(): ExportColumn[] {
    return [
      { key: 'ci_estudiante', label: 'Carnet de Identidad', enabled: true },
      { key: 'nombre_estudiante', label: 'Nombre Completo', enabled: true },
      { key: 'carrera', label: 'Carrera', enabled: true },
      { key: 'total_creditos', label: 'Total U.V.E.', enabled: true },
      { key: 'valor_credito', label: 'Valor por U.V.E.', enabled: true },
      { key: 'credito_tecnologico', label: 'Crédito Tecnológico', enabled: true },
      { key: 'porcentaje_descuento', label: 'Porcentaje Descuento', enabled: true },
      { key: 'monto_primer_pago', label: 'Monto Primer Pago', enabled: true },
      { key: 'plan_primer_pago', label: 'Plan de Pago', enabled: true },
      { key: 'referencia_primer_pago', label: 'Referencia de Pago', enabled: true },
      { key: 'total_semestre', label: 'Total Semestre', enabled: true },
      { key: 'registrado', label: 'Registrado', enabled: false },
      { key: 'comentarios', label: 'Comentarios', enabled: false },
      { key: 'derechos_academicos_originales', label: 'Derechos Académicos Originales', enabled: false, isCalculated: true },
      { key: 'derechos_academicos_descuento', label: 'Derechos Académicos con Descuento', enabled: false, isCalculated: true },
      { key: 'ahorro_descuento', label: 'Ahorro por Descuento', enabled: false, isCalculated: true },
      { key: 'saldo_semestre_original', label: 'Saldo Semestre Original', enabled: false, isCalculated: true },
      { key: 'saldo_semestre_descuento', label: 'Saldo Semestre con Descuento', enabled: false, isCalculated: true }
    ];
  }

  // Exportación a PDF
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
      pageWidth - margin, 18, { align: 'right' });

    // Línea separadora (debajo del bloque del logo y textos)
    doc.setLineWidth(0.5);
    doc.line(margin, 33, pageWidth - margin, 33);
  }

  private addStudentSection(doc: jsPDF, registro: Partial<RegistroEstudiante>, startY: number, pageWidth: number, margin: number, numeroEstudiante: number): number {
    let currentY = startY;

    // Información básica del estudiante en un recuadro
    doc.setFillColor(240, 248, 255); // Azul muy claro
    // Aumentamos la altura del recuadro para incluir una tercera línea (descuento)
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
      let cellX = startX;
      row.forEach((cellValue, cellIndex) => {
        const textAlign = cellIndex === 0 ? 'left' : 'right';
        const xPosition = textAlign === 'left' ? cellX + 2 : cellX + colWidths[cellIndex] - 2;

        doc.setFontSize(8);
        if (cellIndex === 3 && parseFloat(cellValue.toString()) > 0) {
          doc.setTextColor(5, 150, 105); // Verde para diferencias positivas
          doc.setFont('helvetica', 'bold');
        } else {
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
    const derechosAcademicosOriginales = (registro.valor_credito || 0) * (registro.total_creditos || 0);
    const derechosAcademicosConDescuento = derechosAcademicosOriginales * (1 - (registro.porcentaje_descuento || 0));
    const creditoTecnologico = registro.credito_tecnologico || 0;
    const totalOriginal = registro.total_semestre || 0;
    const totalConDescuento = derechosAcademicosConDescuento + creditoTecnologico;
    const montoPrimerPago = registro.monto_primer_pago || 0;

    return [
      [
        'Derechos Académicos',
        derechosAcademicosOriginales.toFixed(2),
        derechosAcademicosConDescuento.toFixed(2),
        (derechosAcademicosOriginales - derechosAcademicosConDescuento).toFixed(2)
      ],
      [
        'Crédito Tecnológico',
        creditoTecnologico.toFixed(2),
        creditoTecnologico.toFixed(2),
        '0.00'
      ],
      [
        'Total Semestre',
        totalOriginal.toFixed(2),
        totalConDescuento.toFixed(2),
        (totalOriginal - totalConDescuento).toFixed(2)
      ],
      [
        'Derecho de Inscripción',
        `(${montoPrimerPago.toFixed(2)})`,
        `(${montoPrimerPago.toFixed(2)})`,
        '0.00'
      ],
      [
        'Saldo Semestre',
        (totalOriginal - montoPrimerPago).toFixed(2),
        (totalConDescuento - montoPrimerPago).toFixed(2),
        ((totalOriginal - montoPrimerPago) - (totalConDescuento - montoPrimerPago)).toFixed(2)
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
