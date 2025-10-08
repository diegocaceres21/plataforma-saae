export interface Gestion {
    id: string;
    gestion: string;
    anio: number;
    tipo: 'Anual' | 'Semestre';
    activo: boolean;
    visible: boolean;
    created_at?: string;
    updated_at?: string;
}
