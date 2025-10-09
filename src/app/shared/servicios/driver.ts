import { Injectable } from '@angular/core';
import { driver, Driver } from 'driver.js';

@Injectable({ providedIn: 'root' })
export class DriverService {
  private driverObj: Driver;

  constructor() {
    this.driverObj = driver({
      showProgress: true,
      allowClose: true,
      animate: true,
      nextBtnText: 'Siguiente',
      prevBtnText: 'Anterior',
      doneBtnText: 'Finalizar',
      progressText: 'Paso {{current}} de {{total}}'
    });
  }

  startTour(steps: any[]) {
    this.driverObj.setSteps(steps);
    this.driverObj.drive();
  }
}