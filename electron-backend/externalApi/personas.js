const axios = require('axios');

// Tokens dinámicos provistos desde el renderer y almacenados en tokenStore
const { getExternalTokens } = require('../tokenStore');

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

async function obtenerIDPersona(carnet) {
  try {
    const url = `https://backend2.ucb.edu.bo/Authentication/api/v1/Personas/ObtenerPersonasPorRegional?idRegional=PJh5GJydX69ABmU3tKVdpQ==&criterioBusqueda=${carnet}&tipoResultado=Objeto`;

    const headers = buildHeaders();
    const response = await axios.get(url, { headers });
    if (response.status === 200) {
      const jsonData = response.data;
      const datos = jsonData.datos || [];
      if (datos.length > 0) {
        //console.log(datos[0].id);
        //return datos;
        return datos[0].id;
      } else {
        throw new Error("No se ha encontrado ningún estudiante con el carnet o nombre: " + carnet);
      }
    } else {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
  } catch (error) {
    throw new Error("El Estudiante no fue encontrado");
  }
}

async function obtenerPersonasPorCarnet(carnet) {
  try {
    const url = `https://backend2.ucb.edu.bo/Authentication/api/v1/Personas/ObtenerPersonasPorRegional?idRegional=PJh5GJydX69ABmU3tKVdpQ==&criterioBusqueda=${carnet}&tipoResultado=Objeto`;

    const headers = buildHeaders();

    const response = await axios.get(url, { headers });
    if (response.status === 200) {
      const jsonData = response.data;
      const datos = jsonData.datos || [];
      return datos;
    } else {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
  } catch (error) {
    throw new Error("Ha ocurrido un error al buscar las personas por carnet" + error.message);
  }
}


async function obtenerKardexEstudiante(id_estudiante) {
  try {
    const url = `https://backend.ucb.edu.bo/Academico/api/v1/Academico/Procesos/Kardex/ObtenerKardexEstudiante?idPersona=${id_estudiante}&idCarrera=4mo9gjV/hDzYrnuqH0/IHA==&esEclesial=0&idRegional=PJh5GJydX69ABmU3tKVdpQ==`;

    const headers = buildHeaders();

    const response = await axios.get(url, { headers });

    if (response.status === 200) {
      const jsonData = response.data;
      const datos = jsonData.datos || [];
      
      if (datos.length > 0) {
        return datos;
      } else {
        throw new Error("No se encontró el estudiante.");
      }
    } else {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
  } catch (error) {
    console.error(`Error: ${error.message}`);
    throw new Error("El Estudiante no fue encontrado");
  }
}

async function obtenerPagosRealizados(id_estudiante) {
  try {
    const url = `https://backend.ucb.edu.bo/Academico/api/v1/Caja/Integracion/ObtenerFacturaPersona?idPersona=${id_estudiante}&idRegional=PJh5GJydX69ABmU3tKVdpQ==&tamanoDePagina=20`;

    const headers = buildHeaders();

    const response = await axios.get(url, { headers });

    if (response.status === 200) {
      const jsonData = response.data;
      const datos = jsonData.datos || [];
      
      if (datos.length > 0) {
        return datos;
      } else {
        throw new Error("No se encontró el estudiante.");
      }
    } else {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
  } catch (error) {
    console.error(`Error: ${error.message}`);
    throw new Error("El Estudiante no fue encontrado");
  }
}

async function obtenerDetalleFactura(numero_maestro, id_regional, orden) {
  try {
    const url = `https://backend.ucb.edu.bo/Academico/api/v1/Caja/Integracion/ObtenerFacturaDetalle?numeroMaestro=${numero_maestro}&idRegional=${id_regional}&orden=${orden}`;

    const headers = buildHeaders();

    const response = await axios.get(url, { headers });

    if (response.status === 200) {
      const jsonData = response.data;
      const datos = jsonData.datos || [];
      
      if (datos.length > 0) {
        return datos;
      } else {
        throw new Error("No se encontró el estudiante.");
      }
    } else {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
  } catch (error) {
    console.error(`Error: ${error.message}`);
    throw new Error("El Estudiante no fue encontrado");
  }
}

async function obtenerNombreCompleto(id_estudiante) {
  try {
    const url = `https://backend.ucb.edu.bo/Academico/api/v1/Academico/FileVirtual/ObtenerDatosPersonales?idPersona=${id_estudiante}`;

    const headers = {
      'Token': TOKEN,
      'Uniquecode': UNIQUE_CODE
    };

    const response = await axios.get(url, { headers });

    if (response.status === 200) {
      const jsonData = response.data;
      const datos = jsonData.datos || {};
      
      if (datos && datos.DatosPersonalesResumido) {
        return datos.DatosPersonalesResumido.nombreCompleto.replace(/\s{2,}/g, ' ').trim();
      } else {
        throw new Error("No se encontró el estudiante.");
      }
    } else {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
  } catch (error) {
    console.error(`Error: ${error.message}`);
    throw new Error("El Estudiante no fue encontrado");
  }
}

module.exports = { obtenerIDPersona, obtenerKardexEstudiante, obtenerPagosRealizados, obtenerDetalleFactura, obtenerNombreCompleto, obtenerPersonasPorCarnet };
