import { ApplicationConfig, provideBrowserGlobalErrorListeners, provideZoneChangeDetection, LOCALE_ID, APP_INITIALIZER, inject } from '@angular/core';
import { provideRouter } from '@angular/router';

import { routes } from './app.routes';
import { provideHttpClient } from '@angular/common/http';
import { registerLocaleData } from '@angular/common';
import localeEsBo from '@angular/common/locales/es-BO';
import { GestionService } from './apoyos-incentivos-becas/servicios/gestion.service';
import { CarreraService } from './apoyos-incentivos-becas/servicios/carrera.service';
import { DepartamentoService } from './apoyos-incentivos-becas/servicios/departamento.service';
import { TarifarioService } from './apoyos-incentivos-becas/servicios/tarifario.service';
import { ApoyoFamiliarService } from './apoyos-incentivos-becas/servicios/apoyo-familiar.service';
import { BeneficioService } from './apoyos-incentivos-becas/servicios/beneficio.service';

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
