import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RegistroEstudiante } from '../../../../interfaces/registro-estudiante';
import { MateriaKardex } from '../../../../interfaces/asignatura';

@Component({
  selector: 'app-student-header-info',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './student-header-info.html',
  styleUrl: './student-header-info.scss'
})
export class StudentHeaderInfoComponent {
  @Input() registro!: Partial<RegistroEstudiante>;
  @Input() showManualOrderIndicator: boolean = false;
  @Input() isInTieGroup: boolean = false;
  @Input() materias: MateriaKardex[] = [];

  @Output() openMaterias = new EventEmitter<void>();

  isPlanPlus(): boolean {
    return this.registro.plan_primer_pago?.toUpperCase() === 'PLAN PLUS';
  }

  openMateriasModal(event: MouseEvent): void {
    event.stopPropagation();
    event.preventDefault();
    this.openMaterias.emit();
  }
}
