export interface CampoConfiguracion {
  key: string;
  label: string;
  type: 'text' | 'number' | 'date' | 'select' | 'checkbox';
  required: boolean;
  options?: { value: any; label: string }[];
  min?: number;
  max?: number;
  step?: number;
}

export interface TablaConfiguracion {
  id: string;
  nombre: string;
  nombreSingular: string;
  icono: string;
  campos: CampoConfiguracion[];
  itemVacio: any;
  permisos: {
    crear: boolean;
    editar: boolean;
    eliminar: boolean;
  };
}