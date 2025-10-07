import { Routes } from '@angular/router';
import { Menu } from './componentes/menu/menu';
import { RegistroMasivo } from './componentes/masivo/registro-masivo/registro-masivo';
import { MainIndividual } from './componentes/individual/main-individual/main-individual';
import { ListaRegistrosComponent } from './componentes/lista-registros/lista-registros';
import { ConfiguracionComponent } from './componentes/configuracion/configuracion';
import { LoginComponent } from './componentes/auth/login/login';
import { AdministracionComponent } from './componentes/administracion/administracion';
import { AdminGuard } from './servicios/admin-guard';

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
