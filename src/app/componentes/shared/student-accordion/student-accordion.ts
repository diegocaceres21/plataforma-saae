import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RegistroEstudiante } from '../../../interfaces/registro-estudiante';
import { StudentHeaderInfoComponent } from '../student-header-info/student-header-info';
import { PaymentPlansDisplayComponent } from '../payment-plans-display/payment-plans-display';

@Component({
  selector: 'app-student-accordion',
  standalone: true,
  imports: [CommonModule, StudentHeaderInfoComponent, PaymentPlansDisplayComponent],
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
  
  @Output() toggleExpanded = new EventEmitter<number>();

  onToggleAccordion(): void {
    this.toggleExpanded.emit(this.index);
  }

  isPlanPlus(): boolean {
    return this.registro.plan_primer_pago?.toUpperCase() === 'PLAN PLUS';
  }
}