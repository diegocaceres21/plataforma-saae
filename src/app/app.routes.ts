import { Routes } from '@angular/router';
import { Menu } from './shared/componentes/menu/menu';
import { RegistroMasivo } from './apoyo-familiar/componentes/registro-masivo/registro-masivo';
import { MainIndividual } from './apoyo-familiar/componentes/individual/main-individual/main-individual';
import { ListaRegistrosComponent } from './apoyo-familiar/componentes/lista-registros/lista-registros';
import { ConfiguracionComponent } from './apoyo-familiar/componentes/configuracion/configuracion';
import { LoginComponent } from './auth/componentes/login/login';
import { AdministracionComponent } from './shared/componentes/administracion/administracion';
import { AdminGuard } from './auth/guardias/admin-guard';

export const routes: Routes = [
    { path: '', redirectTo: '/login', pathMatch: 'full' },
    { path: 'login', component: LoginComponent },
    { path: 'menu', component: Menu },
    { path: 'registro-individual', component: MainIndividual },
    { path: 'registro-masivo', component: RegistroMasivo },
    { path: 'lista-registros', component: ListaRegistrosComponent },
    { path: 'configuracion', component: ConfiguracionComponent },
    { path: 'administracion', component: AdministracionComponent, canActivate: [AdminGuard] },
    {path: '**', redirectTo: '/menu' }
];
