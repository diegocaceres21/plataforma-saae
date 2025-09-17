import { Routes } from '@angular/router';
import { Menu } from './componentes/menu/menu';
import { RegistroMasivo } from './componentes/masivo/registro-masivo/registro-masivo';
import { MainIndividual } from './componentes/individual/main-individual/main-individual';

export const routes: Routes = [
    { path: '', redirectTo: '/menu', pathMatch: 'full' },
    { path: 'menu', component: Menu },
    { path: 'registro-individual', component: MainIndividual },
    { path: 'registro-masivo', component: RegistroMasivo },
    {path: '**', redirectTo: '/menu' }
];
