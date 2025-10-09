const { getExternalTokens, setExternalTokens } = require('../tokenStore');
const { logInSiaan } = require('./auth');

// Credenciales almacenadas para reautenticación automática
let storedCredentials = null;

/**
 * Almacena las credenciales para uso en reautenticación automática
 */
function setStoredCredentials(credentials) {
  storedCredentials = credentials;
  console.log('[API Interceptor] Credenciales almacenadas para reautenticación automática');
}

/**
 * Obtiene las credenciales almacenadas
 */
function getStoredCredentials() {
  return storedCredentials;
}

/**
 * Verifica si el error es un 401 Unauthorized
 */
function isUnauthorizedError(error) {
  // Manejar errores de axios
  if (error.response) {
    return error.response.status === 401;
  }
  
  // Manejar errores que contienen el código en el mensaje
  if (error.message && error.message.includes('401')) {
    return true;
  }
  
  // Manejar AxiosError específicamente
  if (error.isAxiosError && error.response?.status === 401) {
    return true;
  }
  
  return false;
}

/**
 * Intenta reautenticarse usando las credenciales almacenadas
 */
async function attemptReauth() {
  if (!storedCredentials) {
    throw new Error('No hay credenciales almacenadas para reautenticación automática');
  }

  console.log('[API Interceptor] Intentando reautenticación automática...');
  
  try {
    // Generar nuevo uniqueCode para la reautenticación
    const newUniqueCode = generateRandomString();
    const reauthCredentials = {
      ...storedCredentials,
      UniqueCode: newUniqueCode
    };
    
    const result = await logInSiaan(reauthCredentials);
    
    if (result.token) {
      // Actualizar tokens en el store
      setExternalTokens({
        token: result.token,
        uniqueCode: newUniqueCode,
        tokenExpiry: result.tokenExpiry
      });
      
      // Actualizar uniqueCode en credenciales almacenadas para próximas reautenticaciones
      storedCredentials.UniqueCode = newUniqueCode;
      
      console.log('[API Interceptor] Reautenticación exitosa');
      return true;
    }
    
    return false;
  } catch (error) {
    console.error('[API Interceptor] Error en reautenticación:', error.message);
    throw new Error('Fallo en reautenticación automática: ' + error.message);
  }
}

/**
 * Genera una cadena aleatoria para uniqueCode
 */
function generateRandomString() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < 10; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

/**
 * Ejecuta una función de API con retry automático en caso de 401
 * @param {Function} apiFunction - Función async que ejecuta la llamada a la API
 * @param {Array} args - Argumentos para la función
 * @param {number} maxRetries - Número máximo de reintentos (default: 1)
 * @returns {Promise} - Resultado de la función de API
 */
async function executeWithRetry(apiFunction, args = [], maxRetries = 1) {
  let lastError = null;
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      
      // Intentar ejecutar la función
      const result = await apiFunction(...args);
      
      if (attempt > 0) {
        console.log(`[API Interceptor] ✓ Éxito después de reautenticación`);
      }
      
      return result;
    } catch (error) {
      lastError = error;
      
      console.log(`[API Interceptor] Error capturado:`, {
        message: error.message,
        status: error.response?.status,
        isAxiosError: error.isAxiosError,
        hasResponse: !!error.response
      });
      
      // Si es un error 401 y aún tenemos reintentos disponibles
      if (isUnauthorizedError(error) && attempt < maxRetries) {
        console.log(`[API Interceptor] ⚠ Error 401 detectado (intento ${attempt + 1}/${maxRetries + 1})`);
        
        try {
          // Intentar reautenticarse
          await attemptReauth();
          console.log('[API Interceptor] ✓ Reautenticación exitosa, reintentando llamada...');
          // El siguiente intento del loop usará los nuevos tokens
        } catch (reauthError) {
          console.error('[API Interceptor] ✗ Fallo en reautenticación:', reauthError.message);
          // Si falla la reautenticación, lanzar el error original
          throw error;
        }
      } else {
        // Si no es 401 o ya no hay más reintentos, lanzar el error
        if (!isUnauthorizedError(error)) {
          console.log('[API Interceptor] Error no es 401, propagando...');
        } else {
          console.log('[API Interceptor] No quedan más reintentos, propagando error...');
        }
        throw error;
      }
    }
  }
  
  // Si llegamos aquí, todos los intentos fallaron
  throw lastError;
}

/**
 * Crea un wrapper para una función de API que automáticamente maneja reintentos
 */
function wrapWithRetry(apiFunction, maxRetries = 1) {
  return async function(...args) {
    return executeWithRetry(apiFunction, args, maxRetries);
  };
}

module.exports = {
  setStoredCredentials,
  getStoredCredentials,
  executeWithRetry,
  wrapWithRetry,
  isUnauthorizedError,
  attemptReauth
};
