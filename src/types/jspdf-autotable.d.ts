import { jsPDF } from 'jspdf';

declare module 'jspdf' {
  interface jsPDF {
    lastAutoTable: {
      finalY: number;
    };
  }
}

declare module 'jspdf-autotable' {
  interface UserOptions {
    head?: any[][];
    body?: any[][];
    startY?: number;
    styles?: any;
    headStyles?: any;
    alternateRowStyles?: any;
    margin?: any;
    tableWidth?: string | number;
    columnStyles?: any;
  }

  function autoTable(doc: jsPDF, options: UserOptions): jsPDF;

  export default autoTable;
}