export interface PagoReporte {
  fecha: Date;
  factura: string;
  beneficiario: string;
  nit: string;
  monto: number;
}

export interface ReportePagosData {
  estudiante: {
    nombre: string;
    carnet: string;
    carrera: string;
  };
  pagos: PagoReporte[];
  fechaInicio?: string;
  fechaFin?: string;
}
