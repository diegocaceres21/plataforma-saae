import { Component, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Subject, takeUntil } from 'rxjs';
import { RegistroIndividual } from "../registro-individual/registro-individual";
import { VistaIndividual } from "../vista-individual/vista-individual";
import { RegistroIndividualDataService, ViewState } from '../../../../servicios/registro-individual-data';

@Component({
  selector: 'app-main-individual',
  imports: [CommonModule, RegistroIndividual, VistaIndividual],
  templateUrl: './main-individual.html',
  styleUrl: './main-individual.scss'
})
export class MainIndividual implements OnDestroy {

  currentView: ViewState = 'registro';
  private destroy$ = new Subject<void>();

  constructor(private dataService: RegistroIndividualDataService) {
    // Suscribirse a cambios en la vista actual
    this.dataService.currentView$
      .pipe(takeUntil(this.destroy$))
      .subscribe(view => {
        this.currentView = view;
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
}
