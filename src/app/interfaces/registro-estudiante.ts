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
    referencia_primer_pago: string;
    total_semestre: number;
    registrado: boolean;
    comentarios?: string;
}
