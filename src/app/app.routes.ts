import { Routes } from '@angular/router';
import { Menu } from './componentes/menu/menu';
import { RegistroIndividual } from './componentes/individual/registro-individual/registro-individual';
import { RegistroMasivo } from './componentes/masivo/registro-masivo/registro-masivo';

export const routes: Routes = [
    { path: '', redirectTo: '/menu', pathMatch: 'full' },
    { path: 'menu', component: Menu },
    { path: 'registro-individual', component: RegistroIndividual },
    { path: 'registro-masivo', component: RegistroMasivo },
    {path: '**', redirectTo: '/menu' }
];
