import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { ReportePagosData } from '../interfaces/pago-reporte';

@Injectable({
  providedIn: 'root'
})
export class ReportePagosDataService {
  private reporteDataSubject = new BehaviorSubject<ReportePagosData | null>(null);
  public reporteData$ = this.reporteDataSubject.asObservable();

  setReporteData(data: ReportePagosData): void {
    this.reporteDataSubject.next(data);
  }

  clearReporteData(): void {
    this.reporteDataSubject.next(null);
  }

  get currentData(): ReportePagosData | null {
    return this.reporteDataSubject.value;
  }
}
