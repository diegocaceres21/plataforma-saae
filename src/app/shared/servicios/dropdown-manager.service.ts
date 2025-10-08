import { Injectable } from '@angular/core';
import { Subject } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class DropdownManagerService {
  private closeAllDropdowns$ = new Subject<string>();

  // Observable para que los componentes se suscriban
  get closeAllDropdowns() {
    return this.closeAllDropdowns$.asObservable();
  }

  // Método para notificar que se debe cerrar todos los dropdowns excepto el actual
  closeOtherDropdowns(currentDropdownId: string): void {
    this.closeAllDropdowns$.next(currentDropdownId);
  }
}