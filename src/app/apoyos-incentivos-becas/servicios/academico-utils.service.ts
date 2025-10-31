import { Injectable } from '@angular/core';
import { Gestion } from '../interfaces/gestion';

/**
 * Servicio de utilidades para funciones académicas comunes
 * Centraliza lógica reutilizable relacionada con kardex, pagos y gestiones académicas
 */
@Injectable({
  providedIn: 'root'
})
export class AcademicoUtilsService {

  /**
   * Obtiene información del kardex del estudiante para las gestiones activas
   * Retorna el total de créditos acumulados y la carrera del estudiante
   * 
   * @param kardex - Array de semestres del kardex del estudiante
   * @param gestiones_activas - Gestiones académicas activas para buscar en el kardex
   * @returns Promise<[totalCreditos, carrera]>
   * @throws Error si no se encuentra información para las gestiones especificadas
   */
  async obtenerInformacionKardex(kardex: any[], gestiones_activas: Gestion[]): Promise<[number, string]> {
    let totalCreditos: number = 0;
    let carrera: string = '';
    let semestresEncontrados = 0;

    // Crear array de nombres de gestiones para buscar
    const nombresGestiones = gestiones_activas.map(g => g.gestion);

    // Iterar sobre el kardex en orden inverso (más reciente a más antiguo)
    for (let i = kardex.length - 1; i >= 0; i--) {
      const semestre = kardex[i];
      const encabezadoSemestre = semestre.encabezado[0];

      // Verificar si este semestre corresponde a alguna de las gestiones activas
      const gestionEncontrada = nombresGestiones.find(nombre => encabezadoSemestre.includes(nombre));

      if (gestionEncontrada) {
        const creditosSemestre = parseInt(
          semestre.tabla.datos[semestre.tabla.datos.length - 1][6].contenidoCelda[0].contenido,
          10
        );

        // Acumular créditos
        totalCreditos += creditosSemestre;

        // Obtener carrera (solo la primera vez)
        if (!carrera) {
          carrera = semestre.encabezado[semestre.encabezado.length - 1]
            .split(': ')
            .pop()
            ?.normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '') || '';
        }

        semestresEncontrados++;
      }
    }

    // Si no se encontró ningún semestre, lanzar error
    if (semestresEncontrados === 0) {
      const gestionsStr = nombresGestiones.join(', ');
      throw new Error(`No se encontró información para las gestiones "${gestionsStr}" en el kardex del estudiante.`);
    }

    return [totalCreditos, carrera];
  }

  /**
   * Obtiene información del kardex del estudiante para gestiones activas (versión con flag de error)
   * Similar a obtenerInformacionKardex pero retorna un flag en vez de lanzar error
   * 
   * @param kardex - Array de semestres del kardex del estudiante
   * @param gestiones_activas - Gestiones académicas activas para buscar en el kardex
   * @returns Promise<[totalCreditos, carrera, sinKardex]>
   */
  async obtenerInformacionKardexConFlag(kardex: any[], gestiones_activas: Gestion[]): Promise<[number, string, boolean]> {
    let totalCreditos: number = 0;
    let carrera: string = '';
    let semestresEncontrados = 0;

    // Crear array de nombres de gestiones para buscar
    const nombresGestiones = gestiones_activas.map(g => g.gestion);

    // Iterar sobre el kardex en orden inverso
    for (let i = kardex.length - 1; i >= 0; i--) {
      const semestre = kardex[i];
      const encabezadoSemestre = semestre.encabezado[0];

      // Verificar si este semestre corresponde a alguna de las gestiones activas
      const gestionEncontrada = nombresGestiones.find(nombre => encabezadoSemestre.includes(nombre));

      if (gestionEncontrada) {
        const creditosSemestre = parseInt(
          semestre.tabla.datos[semestre.tabla.datos.length - 1][6].contenidoCelda[0].contenido,
          10
        );

        // Acumular créditos
        totalCreditos += creditosSemestre;

        // Obtener carrera (solo la primera vez)
        if (!carrera) {
          carrera = semestre.encabezado[semestre.encabezado.length - 1]
            .split(': ')
            .pop()
            ?.normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '') || '';
        }

        semestresEncontrados++;
      }
    }

    // Retornar flag de error en vez de lanzar excepción
    const sinKardex = semestresEncontrados === 0;

    return [totalCreditos, carrera, sinKardex];
  }


  async obtenerPlanDePagoRealizado(id_estudiante: string, gestiones_activas: Gestion[]): Promise<[string, string, number, boolean, number, boolean]> {
    let referencia = "";
    let planAccedido = "";
    let pagoRealizado = 0;
    let sinPago = false;
    let pagosSemestre = 0;
    let pagoCreditoTecnologico = false;

    if (!window.academicoAPI) {
      // No API available - mark as sin_pago
      return [referencia, 'No encontrado', pagoRealizado, true, pagosSemestre, pagoCreditoTecnologico];
    }

    try {
      const pagos = await window.academicoAPI.obtenerPagosRealizados(id_estudiante);

      for (const pago of pagos) {
        if (pago[4]?.contenidoCelda?.[0]?.contenido === "FACTURA REGULAR") {
          const parametros = pago[pago.length - 1]?.contenidoCelda?.[0]?.parametros;
          if (parametros && parametros.length >= 3) {
            const numeroMaestro = parametros[0]?.valorParametro;
            const idRegional = parametros[1]?.valorParametro;
            const orden = parametros[2]?.valorParametro;

            if (numeroMaestro && idRegional && orden) {
              const detalleFactura = await window.academicoAPI.obtenerDetalleFactura(
                numeroMaestro,
                idRegional,
                orden
              );

              for (const factura of detalleFactura) {
                referencia = factura[1]?.contenidoCelda?.[0]?.contenido || "";

                const gestionEncontrada = gestiones_activas.some(gestion =>
                  referencia.includes(gestion.gestion)
                );

                if (gestionEncontrada) {
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
                  else if(!referencia.includes("TECNOLOGICO")){
                    pagosSemestre += parseFloat(
                      (factura[factura.length - 1]?.contenidoCelda?.[0]?.contenido || "0")
                        .replace(",", "")
                    );
                  }
                  else{
                    pagoCreditoTecnologico = true;
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
      console.error('Error obteniendo plan de pago:', error);
    }

    // If no payment found, mark as sin_pago
    if (!planAccedido) {
      sinPago = true;
    }

    // Return values with sin_pago flag
    return [referencia, planAccedido || 'No encontrado', pagoRealizado, sinPago, pagosSemestre, pagoCreditoTecnologico];
  }
  /**
   * TODO: Agregar aquí otras funciones comunes como:
   * - obtenerPlanDePagoRealizado()
   * - calcularPorcentajesDescuento()
   * - validarInformacionEstudiante()
   * etc.
   */
}
