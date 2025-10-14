# Instrucciones para Implementar Exportaciones

## Estado Actual
✅ El componente de reporte está funcionando correctamente
✅ La tabla muestra todos los datos de pagos
✅ Los botones de exportación están en la UI pero son placeholders

## Para implementar las exportaciones, sigue estos pasos:

### 1. Instalar tipos faltantes
Primero, instala los tipos necesarios para TypeScript:

```bash
npm install --save-dev @types/file-saver
```

### 2. Exportar a Excel (Más Fácil)

Ya tienes `xlsx` instalado. Agrega este código al método `exportarExcel()`:

```typescript
import * as XLSX from 'xlsx';

exportarExcel(): void {
  if (!this.reporteData) return;

  // Preparar datos para Excel
  const excelData = this.reporteData.pagos.map((pago, index) => ({
    '#': index + 1,
    'Fecha': pago.fecha,
    'Nro. Factura': pago.factura,
    'Razón Social': pago.beneficiario,
    'NIT': pago.nit,
    'Importe': pago.monto
  }));

  // Agregar fila de total
  excelData.push({
    '#': '',
    'Fecha': '',
    'Nro. Factura': '',
    'Razón Social': '',
    'NIT': 'TOTAL:',
    'Importe': this.totalImporte
  });

  // Crear workbook y worksheet
  const ws = XLSX.utils.json_to_sheet(excelData);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Pagos');

  // Configurar anchos de columna
  ws['!cols'] = [
    { wch: 5 },   // #
    { wch: 12 },  // Fecha
    { wch: 20 },  // Nro. Factura
    { wch: 40 },  // Razón Social
    { wch: 15 },  // NIT
    { wch: 15 }   // Importe
  ];

  // Descargar archivo
  const fileName = \`Pagos_\${this.reporteData.estudiante.carnet}_\${new Date().toISOString().split('T')[0]}.xlsx\`;
  XLSX.writeFile(wb, fileName);
}
```

### 3. Exportar a PDF

Ya tienes `jspdf` y `jspdf-autotable` instalados. Agrega este código al método `exportarPDF()`:

```typescript
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

exportarPDF(): void {
  if (!this.reporteData) return;

  const doc = new jsPDF();
  
  // Header
  doc.setFontSize(16);
  doc.text('CERTIFICADO DE PAGOS', 105, 15, { align: 'center' });
  
  // Información del estudiante
  doc.setFontSize(10);
  doc.text(\`Estudiante: \${this.reporteData.estudiante.nombre}\`, 14, 30);
  doc.text(\`Carnet: \${this.reporteData.estudiante.carnet}\`, 14, 36);
  
  if (this.reporteData.fechaInicio && this.reporteData.fechaFin) {
    doc.text(\`Período: \${this.reporteData.fechaInicio} - \${this.reporteData.fechaFin}\`, 14, 42);
  }
  
  // Tabla de pagos
  const tableData = this.reporteData.pagos.map((pago, index) => [
    (index + 1).toString(),
    pago.fecha,
    pago.factura,
    pago.beneficiario,
    pago.nit,
    \`Bs. \${pago.monto.toFixed(2)}\`
  ]);
  
  autoTable(doc, {
    startY: this.reporteData.fechaInicio ? 48 : 42,
    head: [['#', 'Fecha', 'Nro. Factura', 'Razón Social', 'NIT', 'Importe']],
    body: tableData,
    foot: [['', '', '', '', 'TOTAL:', \`Bs. \${this.totalImporte.toFixed(2)}\`]],
    theme: 'grid',
    headStyles: { fillColor: [51, 65, 85] },
    footStyles: { fillColor: [241, 245, 249], textColor: [0, 0, 0], fontStyle: 'bold' },
    styles: { fontSize: 9 }
  });
  
  // Guardar PDF
  const fileName = \`Certificado_Pagos_\${this.reporteData.estudiante.carnet}_\${new Date().toISOString().split('T')[0]}.pdf\`;
  doc.save(fileName);
}
```

### 4. Exportar a Word (Más Complejo)

Para Word, necesitas crear una plantilla `.docx` con marcadores. Aquí está el código corregido:

```typescript
import PizZip from 'pizzip';
import Docxtemplater from 'docxtemplater';
import { saveAs } from 'file-saver';

async exportarWord(): Promise<void> {
  if (!this.reporteData) return;

  try {
    // Cargar plantilla desde assets
    const response = await fetch('assets/plantilla_certificado_pagos.docx');
    const arrayBuffer = await response.arrayBuffer();

    const zip = new PizZip(arrayBuffer);
    const doc = new Docxtemplater(zip, { 
      paragraphLoop: true, 
      linebreaks: true 
    });

    // Preparar datos para la plantilla
    const data = {
      nombre_estudiante: this.reporteData.estudiante.nombre,
      carnet_estudiante: this.reporteData.estudiante.carnet,
      fecha_inicio: this.reporteData.fechaInicio || '',
      fecha_fin: this.reporteData.fechaFin || '',
      fecha_actual: new Date().toLocaleDateString('es-BO'),
      pagos: this.reporteData.pagos.map((pago, index) => ({
        numero: index + 1,
        fecha: pago.fecha,
        factura: pago.factura,
        razon_social: pago.beneficiario,
        nit: pago.nit,
        importe: \`Bs. \${pago.monto.toFixed(2)}\`
      })),
      total_importe: \`Bs. \${this.totalImporte.toFixed(2)}\`
    };

    // Renderizar documento
    doc.setData(data);
    doc.render();

    // Generar y descargar
    const output = doc.getZip().generate({ 
      type: 'blob',
      mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    });
    
    const fileName = \`Certificado_Pagos_\${this.reporteData.estudiante.carnet}_\${new Date().toISOString().split('T')[0]}.docx\`;
    saveAs(output, fileName);
    
  } catch (error) {
    console.error('Error al generar documento Word:', error);
    alert('Error al generar el documento Word. Verifica que la plantilla exista en assets/');
  }
}
```

### 5. Crear la plantilla Word

Para que la exportación a Word funcione, necesitas crear un archivo `plantilla_certificado_pagos.docx` en `src/assets/` con estos marcadores:

```
CERTIFICADO DE PAGOS

Estudiante: {nombre_estudiante}
Carnet: {carnet_estudiante}
Período: {fecha_inicio} - {fecha_fin}

DETALLE DE PAGOS

{#pagos}
{numero} | {fecha} | {factura} | {razon_social} | {nit} | {importe}
{/pagos}

TOTAL: {total_importe}

Fecha de emisión: {fecha_actual}
```

### 6. Agregar los imports al componente

Cuando estés listo para implementar, agrega estos imports al inicio del archivo `reporte.ts`:

```typescript
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import PizZip from 'pizzip';
import Docxtemplater from 'docxtemplater';
import { saveAs } from 'file-saver';
```

## Orden recomendado de implementación:

1. ✅ **Excel** - Es el más fácil y no requiere plantillas
2. ✅ **PDF** - Usa jsPDF con autotable, muy directo
3. ✅ **Word** - Requiere crear una plantilla, es el más complejo

## Notas importantes:

- Todos los paquetes necesarios ya están instalados en `package.json`
- Solo falta instalar `@types/file-saver` con el comando mencionado arriba
- La plantilla Word debe estar en `src/assets/` para que sea accesible
- Los nombres de archivo incluyen el carnet del estudiante y la fecha para mejor organización
