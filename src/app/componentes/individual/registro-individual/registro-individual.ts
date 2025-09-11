
import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';


@Component({
  selector: 'app-registro-individual',
  imports: [RouterLink, CommonModule, FormsModule],
  templateUrl: './registro-individual.html',
  styleUrl: './registro-individual.scss'
})
export class RegistroIndividual {
  studentIds: string[] = ['', ''];

  addStudentId() {
    if (this.studentIds.length < 5) {
      this.studentIds.push('');
    }
  }

  removeStudentId(index: number) {
    if (this.studentIds.length > 2) {
      this.studentIds.splice(index, 1);
    }
  }

  onSubmit() {
    // TODO: handle submit logic
    console.log('Student IDs:', this.studentIds);
  }
}
