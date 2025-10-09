const axios = require('axios');

// Tokens dinámicos provistos desde el renderer y almacenados en tokenStore
const { getExternalTokens } = require('../tokenStore');
const { wrapWithRetry } = require('./apiInterceptor');

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

async function _obtenerIDPersona(carnet) {
  const url = `https://backend2.ucb.edu.bo/Authentication/api/v1/Personas/ObtenerPersonasPorRegional?idRegional=PJh5GJydX69ABmU3tKVdpQ==&criterioBusqueda=${carnet}&tipoResultado=Objeto`;

  const headers = buildHeaders();
  // Configurar axios para que lance error en cualquier status que no sea 2xx
  const response = await axios.get(url, { 
    headers,
    validateStatus: (status) => status >= 200 && status < 300 
  });
  
  const jsonData = response.data;
  const datos = jsonData.datos || [];
  if (datos.length > 0) {
    return datos[0].id;
  } else {
    throw new Error("No se ha encontrado ningún estudiante con el carnet o nombre: " + carnet);
  }
}

const obtenerIDPersona = wrapWithRetry(_obtenerIDPersona);

async function _obtenerPersonasPorCarnet(carnet) {
  const url = `https://backend2.ucb.edu.bo/Authentication/api/v1/Personas/ObtenerPersonasPorRegional?idRegional=PJh5GJydX69ABmU3tKVdpQ==&criterioBusqueda=${carnet}&tipoResultado=Objeto`;

  const headers = buildHeaders();
  
  // Configurar axios para que lance error en cualquier status que no sea 2xx
  const response = await axios.get(url, { 
    headers,
    validateStatus: (status) => status >= 200 && status < 300 
  });
  
  const jsonData = response.data;
  const datos = jsonData.datos || [];
  return datos;
}

const obtenerPersonasPorCarnet = wrapWithRetry(_obtenerPersonasPorCarnet);


async function _obtenerKardexEstudiante(id_estudiante) {
  const url = `https://backend.ucb.edu.bo/Academico/api/v1/Academico/Procesos/Kardex/ObtenerKardexEstudiante?idPersona=${id_estudiante}&idCarrera=4mo9gjV/hDzYrnuqH0/IHA==&esEclesial=0&idRegional=PJh5GJydX69ABmU3tKVdpQ==`;

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
    throw new Error("No se encontró el estudiante.");
  }
}

const obtenerKardexEstudiante = wrapWithRetry(_obtenerKardexEstudiante);

async function _obtenerPagosRealizados(id_estudiante) {
  const url = `https://backend.ucb.edu.bo/Academico/api/v1/Caja/Integracion/ObtenerFacturaPersona?idPersona=${id_estudiante}&idRegional=PJh5GJydX69ABmU3tKVdpQ==&tamanoDePagina=20`;

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
    throw new Error("No se encontró el estudiante.");
  }
}

const obtenerPagosRealizados = wrapWithRetry(_obtenerPagosRealizados);

async function _obtenerDetalleFactura(numero_maestro, id_regional, orden) {
  const url = `https://backend.ucb.edu.bo/Academico/api/v1/Caja/Integracion/ObtenerFacturaDetalle?numeroMaestro=${numero_maestro}&idRegional=${id_regional}&orden=${orden}`;

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
    throw new Error("No se encontró el estudiante.");
  }
}

const obtenerDetalleFactura = wrapWithRetry(_obtenerDetalleFactura);

async function _obtenerNombreCompleto(id_estudiante) {
  const url = `https://backend.ucb.edu.bo/Academico/api/v1/Academico/FileVirtual/ObtenerDatosPersonales?idPersona=${id_estudiante}`;

  const headers = buildHeaders();

  const response = await axios.get(url, { 
    headers,
    validateStatus: (status) => status >= 200 && status < 300 
  });

  const jsonData = response.data;
  const datos = jsonData.datos || {};
  
  if (datos && datos.DatosPersonalesResumido) {
    return datos.DatosPersonalesResumido.nombreCompleto.replace(/\s{2,}/g, ' ').trim();
  } else {
    throw new Error("No se encontró el estudiante.");
  }
}

const obtenerNombreCompleto = wrapWithRetry(_obtenerNombreCompleto);

module.exports = { obtenerIDPersona, obtenerKardexEstudiante, obtenerPagosRealizados, obtenerDetalleFactura, obtenerNombreCompleto, obtenerPersonasPorCarnet };
