export interface Solicitud {
    id?: string;
    fecha: string; // ISO date string
    id_gestion: string;
    estado: 'pendiente' | 'procesado' | 'completado' | 'cancelado' | 'desconocido';
    cantidad_estudiantes: number;
    comentarios?: string;
    created_at?: string;
    updated_at?: string;
}

export interface CreateSolicitudData {
    fecha: string;
    id_gestion: string;
    estado: 'pendiente' | 'procesado' | 'completado' | 'cancelado';
    cantidad_estudiantes: number;
    comentarios?: string;
}   
