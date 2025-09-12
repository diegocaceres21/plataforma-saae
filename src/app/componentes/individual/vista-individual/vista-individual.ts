import { Component } from '@angular/core';
import { RegistroEstudiante } from '../../../interfaces/registro-estudiante';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';

@Component({
  selector: 'app-vista-individual',
  imports: [CommonModule, RouterModule],
  templateUrl: './vista-individual.html',
  styleUrl: './vista-individual.scss'
})
export class VistaIndividual {
  registrosEstudiantes: Partial<RegistroEstudiante>[] = [
    {
        ci_estudiante: "E-10268053",
        nombre_estudiante: "CACERES CORTEZ DIEGO ISAIAS",
        carrera: "INGENIERIA EMPRESARIAL",
        total_creditos: 15,
        plan_primer_pago: "PLAN ESTANDAR",
        monto_primer_pago: 1428,
        referencia_primer_pago: "PRIMER PAGO ESTANDAR TUPURAYA 1-2024",
        porcentaje_descuento: 0, //INVENTADO
        valor_credito: 357, //INVENTADO,
        credito_tecnologico: 357, //INVENTADO
        total_semestre: 5712
    },
    {
        ci_estudiante: "6555232",
        nombre_estudiante: "VARGAS SINGER SARA ELENA",
        carrera: "ADMINISTRACION DE EMPRESAS",
        total_creditos: 15,
        plan_primer_pago: "PLAN ESTANDAR",
        monto_primer_pago: 1428,
        referencia_primer_pago: "PRIMER PAGO ESTANDAR TUPURAYA 1-2024",
        porcentaje_descuento: 0.2,
        valor_credito: 357,
        credito_tecnologico: 357,
        total_semestre: 5712
    }
  ];

  expandedItems: Set<number> = new Set();

  toggleAccordion(index: number): void {
    if (this.expandedItems.has(index)) {
      this.expandedItems.delete(index);
    } else {
      this.expandedItems.add(index);
    }
  }

  isExpanded(index: number): boolean {
    return this.expandedItems.has(index);
  }
}
