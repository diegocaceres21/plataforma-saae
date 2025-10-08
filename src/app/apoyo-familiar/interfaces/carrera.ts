export interface Carrera {
    id: string;
    carrera: string;
    id_departamento: string;
    id_tarifario: string;
    incluye_tecnologico: boolean;
    visible: boolean;
    created_at?: string;
    updated_at?: string;
}

export interface CarreraWithRelations extends Carrera {
    departamento?: {
        id: string;
        departamento: string;
        created_at?: string;
        updated_at?: string;
    };
    tarifario?: {
        id: string;
        tarifario: string;
        valor_credito: number;
        visible: boolean;
        created_at?: string;
        updated_at?: string;
    };
}