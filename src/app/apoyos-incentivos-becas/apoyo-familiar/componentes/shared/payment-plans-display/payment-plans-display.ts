import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RegistroEstudiante } from '../../../../interfaces/registro-estudiante';
import { CONSTANTES } from '../../../../../constantes';

@Component({
  selector: 'app-payment-plans-display',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './payment-plans-display.html',
  styleUrl: './payment-plans-display.scss'
})
export class PaymentPlansDisplayComponent {
  @Input() registro!: Partial<RegistroEstudiante>;
  @Input() showBothPlans: boolean = true; // Para mostrar solo el plan con descuento en modo simplificado

  // Cálculos para el plan original
  get derechosAcademicosOriginales(): number {
    return (this.registro.valor_credito || 0) * (this.registro.total_creditos || 0);
  }

  get totalOriginal(): number {
    return this.registro.total_semestre || 0;
  }

  get saldoOriginal(): number {
    return this.totalOriginal - (this.registro.monto_primer_pago || 0) - (this.registro.pagos_realizados || 0)  - (this.registro.pago_credito_tecnologico ? this.registro.credito_tecnologico! : 0);
  }

  // Cálculos para el plan con descuento
  get derechosAcademicosConDescuento(): number {
    return this.registro.creditos_descuento! * (this.registro.valor_credito || 0) * (1 - (this.registro.porcentaje_descuento || 0)) + (this.registro.valor_credito || 0) * (this.registro.total_creditos! - this.registro.creditos_descuento!);
  }

  get totalConDescuento(): number {
    return this.derechosAcademicosConDescuento + (this.registro.porcentaje_descuento !== 1 ? this.registro.credito_tecnologico || 0 : 0);
  }

  get saldoConDescuento(): number {
    return this.totalConDescuento - (this.registro.monto_primer_pago || 0) - (this.registro.pagos_realizados || 0) - (this.registro.pago_credito_tecnologico ? this.registro.credito_tecnologico! : 0);
  }

  // Cálculos de ahorros
  get ahorroDerechosAcademicos(): number {
    return this.derechosAcademicosOriginales - this.derechosAcademicosConDescuento;
  }

  get ahorroTotal(): number {
    return this.totalOriginal - this.totalConDescuento;
  }

  get ahorroSaldo(): number {
    return this.saldoOriginal - this.saldoConDescuento;
  }

  get hasDiscount(): boolean {
    return (this.registro.porcentaje_descuento || 0) > 0;
  }

  get totalProntoPago(): number {
    return this.derechosAcademicosOriginales * (1 - CONSTANTES.DESCUENTO_PRONTO_PAGO) + (this.registro.credito_tecnologico || 0);
  }

  get saldoProntoPago(): number {
    return this.totalProntoPago - (this.registro.monto_primer_pago || 0) - (this.registro.pagos_realizados || 0) - (this.registro.pago_credito_tecnologico ? this.registro.credito_tecnologico! : 0);
  }

  get mostrarProntoPago(): boolean {
    return this.registro.porcentaje_descuento === 0 && !this.registro.carrera?.includes('FILOSOFIA Y LETRAS');
  }
}
