import { Component } from '@angular/core';
import { RegistroIndividual } from "../registro-individual/registro-individual";
import { VistaIndividual } from "../vista-individual/vista-individual";

@Component({
  selector: 'app-main-individual',
  imports: [RegistroIndividual, VistaIndividual],
  templateUrl: './main-individual.html',
  styleUrl: './main-individual.scss'
})
export class MainIndividual {

}
