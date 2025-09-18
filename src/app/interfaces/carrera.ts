export interface Carrera {
    id: string;
    carrera: string;
    id_departamento: string;
    id_tarifario: string;
    incluye_tecnologico: boolean;
    created_at?: string;
}

export interface CarreraWithRelations extends Carrera {
    departamento?: {
        id: string;
        departamento: string;
    };
    tarifario?: {
        id: string;
        tarifario: string;
        valor_credito: number;
        created_at?: string;
        updated_at?: string;
    };
}