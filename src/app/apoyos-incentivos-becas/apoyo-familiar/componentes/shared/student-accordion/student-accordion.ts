import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RegistroEstudiante } from '../../../../interfaces/registro-estudiante';
import { MateriaKardex } from '../../../../interfaces/asignatura';
import { StudentHeaderInfoComponent } from '../student-header-info/student-header-info';
import { PaymentPlansDisplayComponent } from '../payment-plans-display/payment-plans-display';
import { MateriasModalComponent } from '../materias-modal/materias-modal';

@Component({
  selector: 'app-student-accordion',
  standalone: true,
  imports: [CommonModule, StudentHeaderInfoComponent, PaymentPlansDisplayComponent, MateriasModalComponent],
  templateUrl: './student-accordion.html',
  styleUrl: './student-accordion.scss'
})
export class StudentAccordionComponent {
  @Input() registro!: Partial<RegistroEstudiante>;
  @Input() index!: number;
  @Input() isExpanded: boolean = false;
  @Input() showManualOrderIndicator: boolean = false;
  @Input() isInTieGroup: boolean = false;
  @Input() showFullPlans: boolean = true; // Para mostrar ambos planes o solo el con descuento
  @Input() materias: MateriaKardex[] = [];

  @Output() toggleExpanded = new EventEmitter<number>();

  showMateriasModal: boolean = false;

  onToggleAccordion(): void {
    this.toggleExpanded.emit(this.index);
  }

  isPlanPlus(): boolean {
    return this.registro.plan_primer_pago?.toUpperCase() === 'PLAN PLUS';
  }

  openMateriasModal(): void {
    this.showMateriasModal = true;
  }

  closeMateriasModal(): void {
    this.showMateriasModal = false;
  }
}
