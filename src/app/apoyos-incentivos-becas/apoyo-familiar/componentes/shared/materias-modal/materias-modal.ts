import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MateriaKardex } from '../../../../interfaces/asignatura';

@Component({
  selector: 'app-materias-modal',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './materias-modal.html',
  styleUrl: './materias-modal.scss'
})
export class MateriasModalComponent {
  @Input() isOpen: boolean = false;
  @Input() materias: MateriaKardex[] = [];
  @Input() nombreEstudiante: string = '';
  @Input() totalUVE: number = 0;

  @Output() closeModal = new EventEmitter<void>();

  onClose(): void {
    this.closeModal.emit();
  }

  onBackdropClick(event: MouseEvent): void {
    if (event.target === event.currentTarget) {
      this.onClose();
    }
  }

  getTotalUVECalculado(): number {
    return this.materias.reduce((total, m) => total + (m.uve || 0), 0);
  }
}
