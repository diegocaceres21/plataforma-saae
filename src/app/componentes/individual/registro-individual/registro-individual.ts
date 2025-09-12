declare global {
  interface Window {
    academicoAPI?: {
      createGestion: (data: any) => Promise<any>;
      getAllGestion: () => Promise<any>;
      obtenerIDPersona: (carnet: string) => Promise<any>;
      obtenerKardexEstudiante: (id_estudiante: string) => Promise<any>;
      obtenerPagosRealizados: (id_estudiante: string) => Promise<any>;
      obtenerDetalleFactura: (numero_maestro: string, id_regional: string, orden: number) => Promise<any>;
      obtenerNombreCompleto: (id_estudiante: string) => Promise<any>;
    };
  }
}

import { Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { LoadingService } from '../../../servicios/loading';
import { RegistroEstudiante } from '../../../interfaces/registro-estudiante';
import { Gestion } from '../../../interfaces/gestion';
import { VistaIndividual } from "../vista-individual/vista-individual";

@Component({
  selector: 'app-registro-individual',
  imports: [RouterLink, CommonModule, FormsModule, VistaIndividual],
  templateUrl: './registro-individual.html',
  styleUrl: './registro-individual.scss'
})

export class RegistroIndividual {
  carnetEstudiantes: string[] = ['', ''];
  semestreActual: Gestion = { id: '145848848484', gestion: '1-2024', anio: 2024, orden: 1, activo: true };
  registrosEstudiantes: RegistroEstudiante[] = [];
  
  public loadingService = inject(LoadingService);
  
  addStudentId() {
    if (this.carnetEstudiantes.length < 5) {
      this.carnetEstudiantes.push('');
    }
  }

  removeStudentId(index: number) {
    if (this.carnetEstudiantes.length > 2) {
      this.carnetEstudiantes.splice(index, 1);
    }
  }

  async onSubmit() {
    this.loadingService.show();
    
    try {
      // Use Promise.all to wait for all async operations to complete
      await Promise.all(
        this.carnetEstudiantes.map(async (carnet) => {
          if (carnet.trim() && window.academicoAPI?.obtenerIDPersona) {
            const id_estudiante = await window.academicoAPI.obtenerIDPersona(carnet);
            if (id_estudiante) {
              const kardex = await window.academicoAPI.obtenerKardexEstudiante(id_estudiante);
            
              const [totalCreditos, carrera] = await this.obtenerInformacionKardex(kardex, this.semestreActual.gestion);
              const nombreCompleto = await window.academicoAPI.obtenerNombreCompleto(id_estudiante);
              const [referencia, planAccedido, pagoRealizado] = await this.obtenerPlanDePagoRealizado(id_estudiante);
              
              
              
              const registro: Partial<RegistroEstudiante> = {
                ci_estudiante: carnet,
                nombre_estudiante: nombreCompleto || 'N/A',
                carrera: carrera || 'N/A',
                total_creditos: totalCreditos || 0,
                plan_primer_pago: planAccedido || 'N/A',
                monto_primer_pago: pagoRealizado || 0,
                referencia_primer_pago: referencia || 'N/A',
              };
              this.registrosEstudiantes.push(registro as RegistroEstudiante);
              //console.log(`Referencia: ${referencia}, Plan Accedido: ${planAccedido}, Pago Realizado: ${pagoRealizado}`);
            }
          } else {
            console.error('academicoAPI.obtenerIDPersona is not available');
          }
        })
      );

    } catch (error) {
      console.error('Error processing students:', error);
    } finally {
      this.loadingService.hide();
      console.log(this.registrosEstudiantes);

    }
  }

  async obtenerInformacionKardex(kardex: any[], semestre_actual: string): Promise<[number, string]> {
    let totalCreditos: number = 0;
    let carrera: string = '';

    // Iterate over kardex in reverse
    for (let i = kardex.length - 1; i >= 0; i--) {
      const semestre = kardex[i];

      if (semestre.encabezado[0].includes(semestre_actual)) {
        totalCreditos = parseInt(
          semestre.tabla.datos[semestre.tabla.datos.length - 1][6].contenidoCelda[0].contenido,
          10
        );
        // Remueve acentos de la carrera
        carrera = semestre.encabezado[semestre.encabezado.length - 1]
          .split(': ')
          .pop()
          ?.normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '') || '';
        break;
      }
    }

    return [totalCreditos, carrera];
  }

  async obtenerPlanDePagoRealizado(id_estudiante: string): Promise<[string, string, number]> {
    let referencia = "";
    let planAccedido = "";
    let pagoRealizado = 0;
    
    try {
      if (!window.academicoAPI?.obtenerPagosRealizados) {
        throw new Error('obtenerPagosRealizados API not available');
      }
      
      const pagos = await window.academicoAPI.obtenerPagosRealizados(id_estudiante);
      
      for (const pago of pagos) {
        if (pago[4]?.contenidoCelda?.[0]?.contenido === "FACTURA REGULAR") {
          const parametros = pago[pago.length - 1]?.contenidoCelda?.[0]?.parametros;
          if (parametros && parametros.length >= 3) {
            const numeroMaestro = parametros[0]?.valorParametro;
            const idRegional = parametros[1]?.valorParametro;
            const orden = parametros[2]?.valorParametro;
            
            if (numeroMaestro && idRegional && orden && window.academicoAPI?.obtenerDetalleFactura) {
              const detalleFactura = await window.academicoAPI.obtenerDetalleFactura(
                numeroMaestro, 
                idRegional, 
                orden
              );
              
              for (const factura of detalleFactura) {
                referencia = factura[1]?.contenidoCelda?.[0]?.contenido || "";
                
                if (referencia.includes(this.semestreActual.gestion)) {
                  if (referencia.includes("ESTANDAR") || referencia.includes("ESTÁNDAR")) {
                    planAccedido = "PLAN ESTANDAR";
                    pagoRealizado = parseFloat(
                      (factura[factura.length - 1]?.contenidoCelda?.[0]?.contenido || "0")
                        .replace(",", "")
                    );
                    break;
                  } else if (referencia.includes("PLUS")) {
                    planAccedido = "PLAN PLUS";
                    pagoRealizado = parseFloat(
                      (factura[factura.length - 1]?.contenidoCelda?.[0]?.contenido || "0")
                        .replace(",", "")
                    );
                    break;
                  }
                }
              }
              
              if (planAccedido) {
                break;
              }
            }
          }
        }
      }
    } catch (error) {
      console.error('Error in obtenerPlanDePagoRealizado:', error);
    }
    
    return [referencia, planAccedido, pagoRealizado];
  }


  /*async createGestionMock() {
    const data = {
      gestion: '2025',
      anio: 2025,
      orden: 1
    };
    if (window.academicoAPI?.createGestion) {
      const result = await window.academicoAPI.createGestion(data);
      console.log('Created gestion:', result);
      await this.getAllGestionMock();
    } else {
      console.error('academicoAPI.createGestion is not available');
    }
  }

  async getAllGestionMock() {
    if (window.academicoAPI?.getAllGestion) {
      const result = await window.academicoAPI.getAllGestion();
      this.gestionList = result;
      console.log('All gestion:', result);
    } else {
      console.error('academicoAPI.getAllGestion is not available');
    }
  }*/
}
