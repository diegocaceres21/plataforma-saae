import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RegistroEstudiante } from '../../../../interfaces/registro-estudiante';

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

  isPlanPlus(): boolean {
    return this.registro.plan_primer_pago?.toUpperCase() === 'PLAN PLUS';
  }
}
