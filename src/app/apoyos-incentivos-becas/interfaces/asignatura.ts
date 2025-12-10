export interface Asignatura {
    sigla: string;
    asignatura: string;
    tipo: string;
    creditosAcademicos: number;
    uve: number
}

export interface MateriaKardex {
    sigla: string;
    asignatura: string;
    tipo: string;
    evaluacionContinua: string;
    notaFinal: string;
    creditosAcademicos?: number;
    uve?: number;
}