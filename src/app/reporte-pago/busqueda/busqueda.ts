import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { StudentAutocompleteComponent } from '../../shared/componentes/student-autocomplete/student-autocomplete';
import { StudentSearchResult } from '../../shared/interfaces/student-search';

@Component({
  selector: 'app-busqueda',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, StudentAutocompleteComponent],
  templateUrl: './busqueda.html',
  styleUrl: './busqueda.scss'
})
export class Busqueda {
  selectedStudent: StudentSearchResult | null = null;
  
  // Filtro de fechas
  fechaInicio: string = '';
  fechaFin: string = '';
  showDateFilter: boolean = false;

  onStudentSelected(student: StudentSearchResult) {
    this.selectedStudent = student;
    console.log('Estudiante seleccionado:', student);
  }

  toggleDateFilter() {
    this.showDateFilter = !this.showDateFilter;
    // Limpiar fechas si se oculta el filtro
    if (!this.showDateFilter) {
      this.fechaInicio = '';
      this.fechaFin = '';
    }
  }

  clearDateFilter() {
    this.fechaInicio = '';
    this.fechaFin = '';
  }

  onSearch() {
    // Validar que se haya seleccionado un estudiante
    if (!this.selectedStudent) {
      console.warn('No se ha seleccionado ningún estudiante');
      return;
    }

    // Validar fechas si el filtro está activo
    if (this.showDateFilter) {
      if (this.fechaInicio && this.fechaFin) {
        const inicio = new Date(this.fechaInicio);
        const fin = new Date(this.fechaFin);
        
        if (inicio > fin) {
          console.warn('La fecha de inicio no puede ser mayor que la fecha fin');
          return;
        }
      }
    }

    // Preparar criterios de búsqueda
    const searchCriteria = {
      estudiante: this.selectedStudent,
      fechaInicio: this.showDateFilter ? this.fechaInicio : null,
      fechaFin: this.showDateFilter ? this.fechaFin : null
    };

    console.log('Búsqueda con criterios:', searchCriteria);
    
    // TODO: Implementar la lógica de búsqueda
  }
}
