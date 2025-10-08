import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

export interface ManualPaymentData {
  referencia: string;
  planAccedido: string;
  pagoRealizado: number;
}

@Component({
  selector: 'app-manual-payment-modal',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './manual-payment-modal.html',
  styleUrl: './manual-payment-modal.scss'
})
export class ManualPaymentModalComponent {
  @Input() isOpen: boolean = false;
  @Input() studentName: string = '';
  @Input() studentCI: string = '';
  @Output() onSubmit = new EventEmitter<ManualPaymentData>();
  @Output() onCancel = new EventEmitter<void>();
  
  paymentData: ManualPaymentData = {
    referencia: '',
    planAccedido: 'PLAN ESTANDAR',
    pagoRealizado: 0
  };
  
  handleSubmit(): void {
    if (this.isValid()) {
      this.onSubmit.emit({ ...this.paymentData });
      this.resetForm();
    }
  }
  
  handleCancel(): void {
    this.onCancel.emit();
    this.resetForm();
  }
  
  private isValid(): boolean {
    return !!(
      this.paymentData.referencia.trim() &&
      this.paymentData.planAccedido.trim() &&
      this.paymentData.pagoRealizado > 0
    );
  }
  
  private resetForm(): void {
    this.paymentData = {
      referencia: '',
      planAccedido: 'PLAN ESTANDAR',
      pagoRealizado: 0
    };
  }
}
