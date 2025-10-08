export interface RegistroEstudiante {
    id: string;
    id_solicitud: string;
    id_gestion: string;
    id_estudiante_siaan: string;
    ci_estudiante: string;
    nombre_estudiante: string;
    carrera: string;
    total_creditos: number;
    valor_credito: number;
    credito_tecnologico: number;
    porcentaje_descuento: number;
    monto_primer_pago: number;
    plan_primer_pago: string;
    referencia_primer_pago: string; // Campo obligatorio en la base de datos
    total_semestre: number;
    registrado: boolean;
    comentarios?: string;
    created_at?: string;
    updated_at?: string;
    sin_kardex?: boolean; // True si no se encontró información en las gestiones activas
    sin_pago?: boolean; // True si no se encontró plan de pago en el sistema
    // Criterios de búsqueda usados para encontrar al estudiante
    criterio_carnet?: string; // Carnet usado en la búsqueda
    criterio_nombre?: string; // Nombre usado en la búsqueda
    encontrado_por?: 'carnet' | 'nombre'; // Método exitoso de búsqueda
}
