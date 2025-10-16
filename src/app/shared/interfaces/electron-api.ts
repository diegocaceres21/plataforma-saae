// Declaraciones de tipos para las APIs de Electron

declare global {
  interface Window {
    electronAPI?: {
      print: (htmlContent: string) => Promise<{ success: boolean; error?: string }>;
    };
    academicoAPI?: {
      createGestion: (data: any) => Promise<any>;
      getAllGestion: () => Promise<any>;
      getAllVisibleGestion: () => Promise<any>;
      updateGestion: (id: string, data: any) => Promise<any>;
      
      // APIs for apoyo_familiar table
      getAllApoyoFamiliar: () => Promise<any>;
      getApoyoFamiliarById: (id: string) => Promise<any>;
      createApoyoFamiliar: (data: any) => Promise<any>;
      updateApoyoFamiliar: (id: string, data: any) => Promise<any>;
      removeApoyoFamiliar: (id: string) => Promise<any>;
      
      // APIs for tarifario table
      getAllTarifario: () => Promise<any>;
      getAllVisibleTarifario: () => Promise<any>;
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
      getAllVisibleCarrera: () => Promise<any>;
      getCarreraById: (id: string) => Promise<any>;
      createCarrera: (data: any) => Promise<any>;
      updateCarrera: (id: string, data: any) => Promise<any>;
      removeCarrera: (id: string) => Promise<any>;

      // API for beneficio table
      getAllBeneficio: () => Promise<any>;
      getBeneficioById: (id: string) => Promise<any>;
      createBeneficio: (data: any) => Promise<any>;
      updateBeneficio: (id: string, data: any) => Promise<any>;
      removeBeneficio: (id: string) => Promise<any>;
      
      // APIs for solicitud table
      getAllSolicitud: () => Promise<any>;
      getAllVisibleSolicitud: () => Promise<any>;
      getSolicitudById: (id: string) => Promise<any>;
      createSolicitud: (data: any) => Promise<any>;
      updateSolicitud: (id: string, data: any) => Promise<any>;
      removeSolicitud: (id: string) => Promise<any>;
      
      // APIs for registro_estudiante table
      getAllRegistroEstudiante: () => Promise<any>;
      getAllVisibleRegistroEstudiante: () => Promise<any>;
      getRegistroEstudianteById: (id: string) => Promise<any>;
      getRegistroEstudiantesBySolicitud: (id_solicitud: string) => Promise<any>;
      getRegistroEstudiantesByApoyoFamiliar: () => Promise<any>;
      createRegistroEstudiante: (data: any) => Promise<any>;
      updateRegistroEstudiante: (id: string, data: any) => Promise<any>;
      removeRegistroEstudiante: (id: string) => Promise<any>;
      createMultipleRegistroEstudiante: (data: any[]) => Promise<any>;
      
      // External APIs
      obtenerIDPersona: (carnet: string) => Promise<any>;
      obtenerKardexEstudiante: (id_estudiante: string) => Promise<any>;
      obtenerPagosRealizados: (id_estudiante: string, tamanoDePagina?: number) => Promise<any>;
      obtenerDetalleFactura: (numero_maestro: string, id_regional: string, orden: number, soloCabecera?: boolean) => Promise<any>;
      obtenerNombreCompleto: (id_estudiante: string) => Promise<any>;
      obtenerCarrera: (id_estudiante: string) => Promise<any>;
      obtenerPersonasPorCarnet: (carnet: string) => Promise<any>;
      logInSiaan: (credentials: any) => Promise<{ message?: string; token?: string; tokenExpiry?: string; error?: string }>;
      setExternalTokens: (data: { token?: string; uniqueCode?: string; tokenExpiry?: string }) => Promise<{ success: boolean; error?: string }>;
    };
    authAPI?: {
      login: (username: string, password: string) => Promise<{ token?: string; user?: any; error?: string }>;
      verify: (token: string) => Promise<{ valid: boolean; payload?: any; error?: string }>;
      register: (data: { username: string; nombre: string; password: string; rol?: string }) => Promise<{ user?: any; error?: string }>;
    };
    userAPI?: {
      getAllUsers: () => Promise<{ users?: any[]; error?: string }>;
      getUserById: (id: number) => Promise<{ user?: any; error?: string }>;
      createUser: (data: { username: string; nombre: string; password: string; rol: string }) => Promise<{ user?: any; error?: string }>;
      updateUser: (id: number, data: { username?: string; nombre?: string; rol?: string; activo?: boolean }) => Promise<{ user?: any; error?: string }>;
      changePassword: (id: number, newPassword: string) => Promise<{ success: boolean; error?: string }>;
      deleteUser: (id: number) => Promise<{ success: boolean; error?: string }>;
    };
  }
}

export {}; // Hace que este archivo sea un módulo