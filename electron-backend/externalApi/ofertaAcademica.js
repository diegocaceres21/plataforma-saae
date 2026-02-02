const axios = require('axios');

// Tokens dinámicos provistos desde el renderer y almacenados en tokenStore
const { getExternalTokens } = require('../tokenStore');
const { wrapWithRetry } = require('./apiInterceptor');
const { getIdGestiones } = require('../controllers');

function buildHeaders() {
  const { token, uniqueCode } = getExternalTokens();
  if (!token || !uniqueCode) {
    // Se mantiene comportamiento: podríamos lanzar error temprano
    // pero lo dejamos para que cada función maneje su propio mensaje.
  }
  return {
    'Token': token || 'missing-token',
    'Uniquecode': uniqueCode || 'missing-unique-code'
  };
}

/**
 * Obtiene los tipos de subdepartamento de oferta para un periodo académico
 * @param {string} periodo - ID del periodo académico
 * @returns {Promise<Array>} Lista de tipos de subdepartamento
 */
async function _obtenerTiposDepartamento(periodo) {
  const url = `https://backend.ucb.edu.bo/Academico/api/v1/Academico/Procesos/OfertaDeMaterias/ObtenerTipoSubDepartamentoOferta?idRegional=PJh5GJydX69ABmU3tKVdpQ==&idPeriodoAcademico=${periodo}`;

  const headers = buildHeaders();

  const response = await axios.get(url, { 
    headers,
    validateStatus: (status) => status >= 200 && status < 300 
  });

  const jsonData = response.data;
  const datos = jsonData.datos || [];
  
  if (datos.length > 0) {
    return datos;
  } else {
    throw new Error("No se encontraron tipos de departamento para el periodo especificado.");
  }
}

const obtenerTiposDepartamento = wrapWithRetry(_obtenerTiposDepartamento);

/**
 * Obtiene los subdepartamentos de oferta según el tipo y periodo académico
 * @param {string} idTipo - ID del tipo de subdepartamento
 * @param {string} periodo - ID del periodo académico
 * @returns {Promise<Array>} Lista de subdepartamentos
 */
async function _obtenerDepartamentos(idTipo, periodo) {
  const url = `https://backend.ucb.edu.bo/Academico/api/v1/Academico/Procesos/OfertaDeMaterias/ObtenerSubDepartamentosOferta?idRegional=PJh5GJydX69ABmU3tKVdpQ==&idTipo=${idTipo}&idPeriodoAcademico=${periodo}&oficial=1`;

  const headers = buildHeaders();

  const response = await axios.get(url, { 
    headers,
    validateStatus: (status) => status >= 200 && status < 300 
  });

  const jsonData = response.data;
  const datos = jsonData.datos || [];
  
  if (datos.length > 0) {
    return datos;
  } else {
    throw new Error("No se encontraron departamentos para el tipo y periodo especificados.");
  }
}

const obtenerDepartamentos = wrapWithRetry(_obtenerDepartamentos);

/**
 * Obtiene la lista de oferta de materias para una carrera y periodo académico
 * @param {string} idCarrera - ID de la carrera
 * @param {string} periodo - ID del periodo académico
 * @returns {Promise<Array>} Lista de materias ofertadas
 */
async function _obtenerOfertaAcademica(idCarrera, periodo) {
  const url = `https://backend.ucb.edu.bo/Academico/api/v1/Academico/Procesos/OfertaDeMaterias/ObtenerListaOfertaDeMaterias?idCarrera=${idCarrera}&idPeriodoAcademico=${periodo}&tamanoDePagina=500`;

  const headers = buildHeaders();

  const response = await axios.get(url, { 
    headers,
    validateStatus: (status) => status >= 200 && status < 300 
  });

  const jsonData = response.data;
  const datos = jsonData.datos || [];
  
  if (datos.length > 0) {
    return datos;
  } else {
    throw new Error("No se encontró oferta académica para la carrera y periodo especificados.");
  }
}

const obtenerOfertaAcademica = wrapWithRetry(_obtenerOfertaAcademica);

/**
 * Convierte un valor a entero de forma segura
 * @param {*} valor - Valor a convertir
 * @returns {number} Número entero o 0 si falla la conversión
 */
function toIntSeguro(valor) {
  try {
    return parseInt(parseFloat(String(valor).trim()));
  } catch {
    return 0;
  }
}

/**
 * Limpia el nombre de la asignatura y determina su tipo
 * @param {string} nombre - Nombre de la asignatura
 * @returns {Object} { nombreLimpio: string|null, tipo: string|null }
 */
function limpiarNombreYTipo(nombre) {
  let texto = nombre.trim();

  // ❌ Eliminar cerrados
  if (texto.toUpperCase().includes('(CERRADO)')) {
    return { nombreLimpio: null, tipo: null };
  }

  let tipo = 'ESTANDAR';
  const textoUpper = texto.toUpperCase();

  // ✅ INTERSEDES
  if (textoUpper.includes('(INTERSEDES')) {
    tipo = 'INTERSEDES';
    texto = texto.replace(/\(INTERSEDES.*?\)/gi, '');
  }
  // ✅ EXAMEN DE SUFICIENCIA
  else if (textoUpper.includes('(EXAMEN DE SUFICIENCIA)')) {
    tipo = 'EXAMEN DE SUFICIENCIA';
    texto = texto.replace(/\(EXAMEN DE SUFICIENCIA\)/gi, '');
  }
  // ✅ TALLER DE GRADO DIPLOMADO
  else if (textoUpper.includes('(TALLER DE GRADO DIPLOMADO)')) {
    tipo = 'TALLER DE GRADO DIPLOMADO';
    texto = texto.replace(/\(TALLER DE GRADO DIPLOMADO\)/gi, '');
  }
  // ✅ CURSO DE IDIOMAS (con paréntesis anidados)
  else if (textoUpper.includes('(CURSO DE IDIOMAS')) {
    const tipoMatch = texto.match(/\(CURSO DE IDIOMAS.*\)/i);
    if (tipoMatch) {
      tipo = 'CURSO DE IDIOMAS (NO CURRICULAR)';
      texto = texto.replace(tipoMatch[0], '');
    }
  }

  else if (textoUpper.includes('(CURSO DE FORMACION CONTINUA')) {
    const tipoMatch = texto.match(/\(CURSO DE FORMACION CONTINUA.*\)/i);
    if (tipoMatch) {
      tipo = 'CURSO DE FORMACION CONTINUA (NO CURRICULAR)';
      texto = texto.replace(tipoMatch[0], '');
    }
  }
  

  // ✅ Limpiar etiquetas [VIRTUAL], [SEMI PRESENCIAL]
  texto = texto.replace(/\[.*?\]/g, '');

  // ✅ Limpieza final
  texto = texto.replace(/\s{2,}/g, ' ').trim();

  return { nombreLimpio: texto, tipo };
}

/**
 * Procesa un departamento y retorna sus asignaturas únicas
 * @param {string} departamentoVal - ID del departamento
 * @param {string} periodo - ID del periodo académico
 * @param {boolean} esAnual - Indica si es un departamento anual
 * @returns {Promise<Object>} Objeto con asignaturas únicas indexadas por clave
 */
async function procesarDepartamento(departamentoVal, periodo) {
  const asignaturasLocales = {};

  try {
    const ofertas = await _obtenerOfertaAcademica(departamentoVal, periodo);

    for (const asignaturaItem of ofertas) {
      // Verificar que el UVE no esté vacío (índice 5)
      if (asignaturaItem[5]?.contenidoCelda?.[0]?.contenido !== '') {
        const sigla = asignaturaItem[1]?.contenidoCelda?.[0]?.contenido?.trim() || '';
        const nombreRaw = asignaturaItem[3]?.contenidoCelda?.[0]?.contenido?.trim() || '';

        const { nombreLimpio, tipo } = limpiarNombreYTipo(nombreRaw);

        if (nombreLimpio === null) {
          continue;
        }

        const clave = `${sigla}|${nombreLimpio}|${tipo}`;

        if (!asignaturasLocales[clave]) {
          asignaturasLocales[clave] = {
            sigla,
            asignatura: nombreLimpio,
            tipo,
            creditosAcademicos: toIntSeguro(
              asignaturaItem[4]?.contenidoCelda?.[0]?.contenido || 0
            ),
            uve: toIntSeguro(
              asignaturaItem[5]?.contenidoCelda?.[0]?.contenido || 0
            ),
          };
        }
      }
    }
  } catch (error) {
    // Silenciar errores individuales de departamentos
    // console.error(`Error procesando departamento ${departamentoVal}:`, error.message);
  }

  return asignaturasLocales;
}

/**
 * Obtiene todas las asignaturas disponibles para todos los periodos académicos activos
 * @returns {Promise<Array>} Array de asignaturas únicas
 */
async function _obtenerAsignaturas() {
  // 1️⃣ Obtener gestiones activas de la base de datos
  const gestionesData = await getIdGestiones();
  const gestionesActivas = gestionesData.map(g => g.id_gestion_siaan);
  console.log('Gestiones activas encontradas:', gestionesActivas);
  
  if (gestionesActivas.length === 0) {
    console.warn('No hay gestiones activas');
    return [];
  }

  const departamentos = [];

  // 2️⃣ Obtener todos los departamentos para cada gestión activa
  for (const gestion of gestionesActivas) {
    try {
      const tipos = await _obtenerTiposDepartamento(gestion);
      const tiposDepartamento = tipos.map(tipo => tipo.valor);

      for (const tipoVal of tiposDepartamento) {
        try {
          const deptList = await _obtenerDepartamentos(tipoVal, gestion);
          for (const departamentoItem of deptList) {
            departamentos.push({
              departamento: departamentoItem.valor,
              gestion: gestion
            });
          }
        } catch (error) {
          // Continuar con otros tipos si uno falla
          console.error(`Error obteniendo departamentos para tipo ${tipoVal} y gestión ${gestion}:`, error.message);
        }
      }
    } catch (error) {
      console.error(`Error obteniendo tipos de departamento para gestión ${gestion}:`, error.message);
    }
  }

  // 3️⃣ Procesar asignaturas - procesamiento paralelo con Promise.allSettled
  const asignaturasDict = {};

  // Procesar en lotes para no sobrecargar el servidor
  const BATCH_SIZE = 10;
  for (let i = 0; i < departamentos.length; i += BATCH_SIZE) {
    const batch = departamentos.slice(i, i + BATCH_SIZE);
    const promises = batch.map(dep => 
      procesarDepartamento(dep.departamento, dep.gestion)
    );

    const results = await Promise.allSettled(promises);

    for (const result of results) {
      if (result.status === 'fulfilled') {
        Object.assign(asignaturasDict, result.value);
      }
    }
  }

  // Convertir el diccionario a array de valores
  return Object.values(asignaturasDict);
}

const obtenerAsignaturas = wrapWithRetry(_obtenerAsignaturas);

module.exports = { 
  obtenerTiposDepartamento, 
  obtenerDepartamentos, 
  obtenerOfertaAcademica,
  obtenerAsignaturas
};
