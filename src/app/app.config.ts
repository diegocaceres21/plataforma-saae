import { ApplicationConfig, provideBrowserGlobalErrorListeners, provideZoneChangeDetection, LOCALE_ID, APP_INITIALIZER, inject } from '@angular/core';
import { provideRouter } from '@angular/router';

import { routes } from './app.routes';
import { provideHttpClient } from '@angular/common/http';
import { registerLocaleData } from '@angular/common';
import localeEsBo from '@angular/common/locales/es-BO';
import { GestionService } from './apoyo-familiar/servicios/gestion.service';
import { CarreraService } from './apoyo-familiar/servicios/carrera.service';
import { DepartamentoService } from './apoyo-familiar/servicios/departamento.service';
import { TarifarioService } from './apoyo-familiar/servicios/tarifario.service';
import { ApoyoFamiliarService } from './apoyo-familiar/servicios/apoyo-familiar.service';
import { BeneficioService } from './apoyo-familiar/servicios/beneficio.service';

registerLocaleData(localeEsBo, 'es-BO');
export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideRouter(routes),
    provideHttpClient(),
    { provide: LOCALE_ID, useValue: 'es-BO' },
    {
      provide: APP_INITIALIZER,
      multi: true,
      useFactory: () => {
        const gestionSvc = inject(GestionService);
        const carreraSvc = inject(CarreraService);
        const deptoSvc = inject(DepartamentoService);
        const tarifarioSvc = inject(TarifarioService);
        const apoyoFamiliarSvc = inject(ApoyoFamiliarService);
        const beneficioSvc = inject(BeneficioService);
        return async () => {
          try {
            // Cargar datos base en paralelo
            await Promise.all([
              deptoSvc.loadDepartamentoData(),
              tarifarioSvc.loadTarifarioData(),
              apoyoFamiliarSvc.loadApoyoFamiliarData(),
              beneficioSvc.loadBeneficioData()
            ]);
            // Luego dependientes
            await Promise.all([
              gestionSvc.loadGestionData(),
              carreraSvc.loadCarreraData()
            ]);
          } catch (e) {
            console.error('APP_INITIALIZER preload error', e);
          }
        };
      }
    }
  ]
};
