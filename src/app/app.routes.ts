import { Routes } from '@angular/router';
import { Menu } from './shared/componentes/menu/menu';
import { RegistroMasivo } from './apoyos-incentivos-becas/apoyo-familiar/componentes/registro-masivo/registro-masivo';
import { MainIndividual } from './apoyos-incentivos-becas/apoyo-familiar/componentes/individual/main-individual/main-individual';
import { RegistroIndividual } from './apoyos-incentivos-becas/apoyo-familiar/componentes/individual/registro-individual/registro-individual';
import { VistaIndividual } from './apoyos-incentivos-becas/apoyo-familiar/componentes/individual/vista-individual/vista-individual';
import { ListaRegistrosComponent } from './apoyos-incentivos-becas/apoyo-familiar/componentes/lista-registros/lista-registros';
import { ConfiguracionComponent } from './apoyos-incentivos-becas/apoyo-familiar/componentes/configuracion/configuracion';
import { BeneficiosIndividual } from './apoyos-incentivos-becas/apoyo-familiar/componentes/individual/beneficios-individual/beneficios-individual';
import { LoginComponent } from './auth/componentes/login/login';
import { AdministracionComponent } from './shared/componentes/administracion/administracion';
import { AdminGuard } from './auth/guardias/admin-guard';
import { Busqueda } from './reporte-pago/busqueda/busqueda';
import { MainMenu } from './shared/componentes/main-menu/main-menu';
import { Reporte } from './reporte-pago/reporte/reporte';

export const routes: Routes = [
    { path: '', redirectTo: '/login', pathMatch: 'full' },
    { path: 'login', component: LoginComponent },
    { path: 'menu', component: Menu },
    { path: 'menu-principal', component: MainMenu },
    { path: 'registro-individual', component: RegistroIndividual },
    { path: 'vista-individual', component: VistaIndividual },
    { path: 'registro-masivo', component: RegistroMasivo },
    { path: 'beneficios-individual', component: BeneficiosIndividual },
    { path: 'reporte-pagos', component:  Busqueda},
    { path: 'resultado-pagos', component:  Reporte},
    { path: 'lista-registros', component: ListaRegistrosComponent },
    { path: 'configuracion', component: ConfiguracionComponent },
    { path: 'administracion', component: AdministracionComponent, canActivate: [AdminGuard] },
    {path: '**', redirectTo: '/menu-principal' }
];
