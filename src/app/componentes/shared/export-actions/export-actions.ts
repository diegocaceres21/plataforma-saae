import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RegistroEstudiante } from '../../../interfaces/registro-estudiante';
import { ExportService } from '../../../servicios/export.service';
import { ExportConfig } from '../../../interfaces/export-config';
import { ExportConfigModalComponent } from '../export-config-modal/export-config-modal';

@Component({
  selector: 'app-export-actions',
  standalone: true,
  imports: [CommonModule, ExportConfigModalComponent],
  templateUrl: './export-actions.html',
  styleUrl: './export-actions.scss'
})
export class ExportActionsComponent {
  @Input() registros: Partial<RegistroEstudiante>[] = [];
  @Input() showSaveButton: boolean = true;
  @Input() documentTitle: string = 'REPORTE DE APOYO FAMILIAR';
  @Input() isSaving: boolean = false;
  
  @Output() saveClicked = new EventEmitter<void>();

  // Estados de exportación
  isGeneratingPDF = false;
  isExporting = false;
  showExportModal = false;

  constructor(private exportService: ExportService) {}

  exportarPDF(): void {
    if (this.registros.length === 0) {
      return;
    }
    
    this.isGeneratingPDF = true;
    
    this.exportService.exportToPDF(this.registros, this.documentTitle)
      .then(() => {
        this.isGeneratingPDF = false;
      })
      .catch(() => {
        this.isGeneratingPDF = false;
      });
  }

  exportarExcel(): void {
    if (this.registros.length === 0) {
      return;
    }
    
    this.showExportModal = true;
  }

  onExportModalClose(): void {
    this.showExportModal = false;
  }

  onExportConfirmed(config: ExportConfig): void {
    this.showExportModal = false;
    this.isExporting = true;
    
    this.exportService.exportToExcel(this.registros, config)
      .then(() => {
        this.isExporting = false;
      })
      .catch(() => {
        this.isExporting = false;
      });
  }

  onSave(): void {
    this.saveClicked.emit();
  }
}
