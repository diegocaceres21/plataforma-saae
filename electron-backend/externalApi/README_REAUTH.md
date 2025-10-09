# Sistema de Reautenticación Automática - API Externa

## Descripción General

Este sistema implementa un mecanismo de **reautenticación automática** para manejar errores de `401 Unauthorized` en las llamadas a la API externa (SIAAN). Cuando se detecta un error de autenticación, el sistema automáticamente:

1. Detecta el error 401
2. Reautentica usando las credenciales almacenadas
3. Reintentar la operación original con los nuevos tokens
4. Retorna el resultado sin pérdida de datos

## Componentes del Sistema

### 1. `apiInterceptor.js`
Módulo central que maneja la lógica de reintentos y reautenticación.

**Funciones principales:**
- `setStoredCredentials(credentials)`: Almacena credenciales para reautenticación
- `executeWithRetry(apiFunction, args, maxRetries)`: Ejecuta función con reintentos automáticos
- `wrapWithRetry(apiFunction, maxRetries)`: Crea wrapper de función con reintentos
- `attemptReauth()`: Intenta reautenticarse con credenciales almacenadas

### 2. Modificaciones en `personas.js`
Todas las funciones de API han sido envueltas con `wrapWithRetry()`:

```javascript
// Función original se convierte en función privada con prefijo _
async function _obtenerPersonasPorCarnet(carnet) {
  // ... lógica de la función
}

// Se exporta versión envuelta con retry automático
const obtenerPersonasPorCarnet = wrapWithRetry(_obtenerPersonasPorCarnet);
```

**Funciones protegidas:**
- `obtenerIDPersona()`
- `obtenerPersonasPorCarnet()`
- `obtenerKardexEstudiante()`
- `obtenerPagosRealizados()`
- `obtenerDetalleFactura()`

### 3. Modificaciones en `main.js`
El handler de login ahora almacena las credenciales automáticamente:

```javascript
ipcMain.handle('api:logInSiaan', async (event, credentials) => {
  const result = await externalApi.auth.logInSiaan(credentials);
  
  if (result.token) {
    setStoredCredentials(credentials); // Almacena para reuso
  }
  
  return result;
});
```

## Flujo de Operación

### Flujo Normal (Sin errores)
```
Usuario → Llamada API → Respuesta exitosa → Usuario
```

### Flujo con Error 401 (Con reautenticación)
```
Usuario → Llamada API → Error 401 detectado
                           ↓
         Reautenticación automática (logInSiaan)
                           ↓
         Actualización de tokens (setExternalTokens)
                           ↓
         Reintento de llamada API original
                           ↓
         Respuesta exitosa → Usuario
```

## Características

✅ **Transparente**: No requiere cambios en el código del frontend  
✅ **Automático**: Maneja reintentos sin intervención del usuario  
✅ **Sin pérdida de datos**: Preserva el contexto de la operación original  
✅ **Configurable**: Número de reintentos ajustable (default: 1)  
✅ **Logging**: Registra eventos de reautenticación en consola  
✅ **Fallback**: Si falla reautenticación, retorna error original  

## Configuración

### Ajustar número de reintentos

Por defecto, cada función tiene **1 reintento** (2 intentos totales). Para cambiar:

```javascript
// En personas.js
const obtenerPersonasPorCarnet = wrapWithRetry(_obtenerPersonasPorCarnet, 2); // 2 reintentos
```

### Extracción de uniqueCode

El sistema intenta extraer el `uniqueCode` del token JWT automáticamente. Si la estructura del token cambia, modificar la función `extractUniqueCodeFromToken()` en `apiInterceptor.js`:

```javascript
function extractUniqueCodeFromToken(token) {
  const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString());
  return payload.uniqueCode || payload.unique_code || null;
}
```

## Logs y Debugging

El sistema registra eventos importantes en consola:

```
[API Interceptor] Credenciales almacenadas para reautenticación automática
[API Interceptor] Error 401 detectado (intento 1/2)
[API Interceptor] Intentando reautenticación automática...
[API Interceptor] Reautenticación exitosa
[API Interceptor] Reintentando llamada a la API...
```

## Manejo de Errores

### Errores manejados automáticamente:
- **401 Unauthorized**: Reautentica y reintenta

### Errores que se propagan directamente:
- **400 Bad Request**: Error en parámetros
- **404 Not Found**: Recurso no encontrado
- **500 Internal Server Error**: Error del servidor
- Cualquier otro código de estado

### Si falla la reautenticación:
El sistema lanza el error original de la API para que el usuario pueda manejarlo apropiadamente.

## Consideraciones de Seguridad

⚠️ **Credenciales en memoria**: Las credenciales se almacenan en memoria del proceso principal de Electron. No persisten entre reinicios de la aplicación.

⚠️ **Token expiry**: El sistema no verifica la fecha de expiración del token antes de usarlo. Confía en que el servidor retornará 401 cuando expire.

## Extensión a Otras APIs

Para agregar reautenticación a nuevas funciones de API:

1. Importar el wrapper:
```javascript
const { wrapWithRetry } = require('./apiInterceptor');
```

2. Convertir función a privada (prefijo `_`):
```javascript
async function _nuevaFuncionAPI(param) {
  // ... implementación
}
```

3. Exportar versión envuelta:
```javascript
const nuevaFuncionAPI = wrapWithRetry(_nuevaFuncionAPI);
module.exports = { nuevaFuncionAPI };
```

## Testing

Para probar el sistema de reautenticación:

1. Login con credenciales válidas
2. Manualmente invalidar el token en `tokenStore.js`
3. Realizar una operación que use la API
4. Verificar en consola que se ejecuta reautenticación
5. Confirmar que la operación se completa exitosamente

## Limitaciones Conocidas

- Solo maneja errores 401 (Unauthorized)
- Requiere que las credenciales de login sean válidas
- No maneja cambios de contraseña durante la sesión
- El uniqueCode debe estar presente en el token JWT

## Mantenimiento

Al agregar nuevos endpoints a la API externa:
1. Crear función base en `personas.js` (o archivo apropiado)
2. Envolver con `wrapWithRetry()`
3. Exportar versión envuelta
4. No requiere cambios en `main.js` ni en el frontend
