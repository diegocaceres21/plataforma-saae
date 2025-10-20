export interface Beneficio {
    id: string;
    nombre: string;
    tipo: string;
    porcentaje?: number;
    limite_creditos?: number; // Límite de créditos para aplicar el beneficio
}
