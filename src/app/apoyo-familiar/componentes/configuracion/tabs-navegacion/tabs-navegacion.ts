import { Component, inject, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ConfiguracionService } from '../../../../shared/servicios/configuracion';
import { Subject, takeUntil } from 'rxjs';

interface TabItem {
  id: string;
  nombre: string;
  icono: string;
  activa: boolean;
}

@Component({
  selector: 'app-tabs-navegacion',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="mb-8">
      <div class="border-b border-gray-200">
        <nav class="-mb-px flex space-x-8" aria-label="Tabs">
          @for (tab of tabs; track tab.id) {
            <button
              (click)="cambiarTab(tab.id)"
              [class]="tab.activa
                ? 'border-blue-500 text-blue-600 whitespace-nowrap py-2 px-1 border-b-2 font-medium text-sm'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 whitespace-nowrap py-2 px-1 border-b-2 font-medium text-sm'"
              type="button"
              [attr.aria-selected]="tab.activa"
              role="tab">
              {{ tab.icono }} {{ tab.nombre }}
            </button>
          }
        </nav>
      </div>
    </div>
  `,
  styles: [`
    .tab-transition {
      transition: all 0.2s ease-in-out;
    }

    button:focus {
      outline: 2px solid transparent;
      outline-offset: 2px;
      box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.5);
    }

    button:hover {
      transform: translateY(-1px);
    }
  `]
})
export class TabsNavegacionComponent implements OnInit, OnDestroy {
  private configuracionService = inject(ConfiguracionService);
  private destroy$ = new Subject<void>();

  tabs: TabItem[] = [];

  ngOnInit(): void {
    this.inicializarTabs();
    this.suscribirACambios();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private inicializarTabs(): void {
    const tablas = this.configuracionService.getTablas();
    this.tabs = tablas.map(tabla => ({
      id: tabla.id,
      nombre: tabla.nombre,
      icono: tabla.icono,
      activa: tabla.id === this.configuracionService.tablaActiva
    }));
  }

  private suscribirACambios(): void {
    this.configuracionService.tablaActiva$
      .pipe(takeUntil(this.destroy$))
      .subscribe(tablaActiva => {
        this.actualizarTabsActiva(tablaActiva);
      });
  }

  private actualizarTabsActiva(tablaActiva: string): void {
    this.tabs = this.tabs.map(tab => ({
      ...tab,
      activa: tab.id === tablaActiva
    }));
  }

  cambiarTab(tabId: string): void {
    this.configuracionService.cambiarTabla(tabId);
  }
}
