const axios = require('axios');

/**
 * Inicia sesión en el backend SIAAÑ (endpoint externo) con credenciales email/clave.
 * @param {{email?:string,password?:string} | any} credentials cuerpo a reenviar al endpoint externo
 * Devuelve { message, token, tokenExpiry } si éxito, o lanza error.
 */
async function logInSiaan(credentials) {
  try {
    if (!credentials || typeof credentials !== 'object') {
      throw new Error('Credenciales inválidas');
    }
    const url = 'https://backend2.ucb.edu.bo/Authentication/api/v1/Authentication/LogInEmail';
    const response = await axios.post(url, credentials, { validateStatus: () => true });

    if (response.status !== 200) {
      throw new Error(response.data?.message || `Login falló (${response.status})`);
    }

    // Algunos adaptadores devuelven headers en objeto plano
    const token = response.headers['token'] || response.headers['Token'] || response.headers['authorization'];
    const tokenExpiry = response.headers['tokenexpiry'] || response.headers['TokenExpiry'] || null;

    return { message: 'Login exitoso', token, tokenExpiry };
  } catch (error) {
    throw new Error(error.message || 'Error en logInSiaan');
  }
}

module.exports = { logInSiaan };
