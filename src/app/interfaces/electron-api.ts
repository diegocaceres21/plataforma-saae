// Declaraciones de tipos para las APIs de Electron

declare global {
  interface Window {
    electronAPI?: {
      print: (htmlContent: string) => Promise<{ success: boolean; error?: string }>;
    };
    academicoAPI?: {
      createGestion: (data: any) => Promise<any>;
      getAllGestion: () => Promise<any>;
      
      // APIs for apoyo_familiar table
      getAllApoyoFamiliar: () => Promise<any>;
      getApoyoFamiliarById: (id: string) => Promise<any>;
      createApoyoFamiliar: (data: any) => Promise<any>;
      updateApoyoFamiliar: (id: string, data: any) => Promise<any>;
      removeApoyoFamiliar: (id: string) => Promise<any>;
      
      // APIs for tarifario table
      getAllTarifario: () => Promise<any>;
      getTarifarioById: (id: string) => Promise<any>;
      createTarifario: (data: any) => Promise<any>;
      updateTarifario: (id: string, data: any) => Promise<any>;
      removeTarifario: (id: string) => Promise<any>;
      
      // APIs for departamento table
      getAllDepartamento: () => Promise<any>;
      getDepartamentoById: (id: string) => Promise<any>;
      createDepartamento: (data: any) => Promise<any>;
      updateDepartamento: (id: string, data: any) => Promise<any>;
      removeDepartamento: (id: string) => Promise<any>;
      
      // APIs for carrera table
      getAllCarrera: () => Promise<any>;
      getCarreraById: (id: string) => Promise<any>;
      createCarrera: (data: any) => Promise<any>;
      updateCarrera: (id: string, data: any) => Promise<any>;
      removeCarrera: (id: string) => Promise<any>;
      
      // External APIs
      obtenerIDPersona: (carnet: string) => Promise<any>;
      obtenerKardexEstudiante: (id_estudiante: string) => Promise<any>;
      obtenerPagosRealizados: (id_estudiante: string) => Promise<any>;
      obtenerDetalleFactura: (numero_maestro: string, id_regional: string, orden: number) => Promise<any>;
      obtenerNombreCompleto: (id_estudiante: string) => Promise<any>;
      obtenerPersonasPorCarnet: (carnet: string) => Promise<any>;
    };
  }
}

export {}; // Hace que este archivo sea un módulo