# Guía de Testing - Sistema de Reautenticación Automática

## Prerequisitos

Antes de probar, asegúrate de:
1. Tener credenciales válidas de SIAAN (Email)
2. La aplicación debe estar en modo desarrollo o producción
3. Tener acceso a la consola del proceso principal de Electron

## Cómo Probar el Sistema

### Prueba 1: Login Normal

1. Inicia sesión en la aplicación
2. Observa en la consola del proceso principal (terminal electron):
   ```
   [Main] Credenciales almacenadas para reautenticación automática
   ```
3. Realiza una búsqueda de estudiante
4. Verifica que funcione normalmente

**Resultado esperado**: Todo funciona sin errores

### Prueba 2: Simulación de Token Expirado

Para simular un token expirado y probar la reautenticación:

#### Opción A: Modificar tokenStore temporalmente

1. Después de hacer login, abre `electron-backend/tokenStore.js`
2. Modifica temporalmente `getExternalTokens()`:
   ```javascript
   function getExternalTokens() {
     return { 
       token: 'invalid-token',  // Token inválido
       uniqueCode: 'invalid-code',
       ...externalTokens 
     };
   }
   ```
3. Guarda y reinicia la aplicación
4. Realiza una búsqueda de estudiante

**Resultado esperado**:
- Consola muestra:
  ```
  [API Interceptor] Ejecutando _obtenerPersonasPorCarnet (intento 1/2)
  [API Interceptor] Error capturado: { status: 401, ... }
  [API Interceptor] ⚠ Error 401 detectado (intento 1/2)
  [API Interceptor] Intentando reautenticación automática...
  [API Interceptor] ✓ Reautenticación exitosa, reintentando llamada...
  [API Interceptor] Ejecutando _obtenerPersonasPorCarnet (intento 2/2)
  [API Interceptor] ✓ Éxito después de reautenticación
  ```
- La búsqueda se completa exitosamente
- No hay errores visibles para el usuario

#### Opción B: Esperar expiración natural

1. Inicia sesión
2. Espera el tiempo de expiración del token (verificar en response headers: `tokenExpiry`)
3. Intenta realizar una búsqueda

**Resultado esperado**: Mismos logs que en Opción A

### Prueba 3: Credenciales Inválidas

1. Modifica temporalmente `main.js` para almacenar credenciales incorrectas:
   ```javascript
   setStoredCredentials({ Email: 'invalid@test.com', UniqueCode: 'test', ServiceCode: '1' });
   ```
2. Simula token expirado (Prueba 2)
3. Realiza búsqueda

**Resultado esperado**:
- Consola muestra:
  ```
  [API Interceptor] ⚠ Error 401 detectado
  [API Interceptor] Intentando reautenticación automática...
  [API Interceptor] ✗ Fallo en reautenticación: ...
  ```
- Error 401 se propaga al frontend
- Usuario ve mensaje de error

### Prueba 4: Sin Credenciales Almacenadas

1. Comenta la línea en `main.js` que llama a `setStoredCredentials()`
2. Reinicia la aplicación
3. Intenta hacer login y luego simula token expirado

**Resultado esperado**:
- Error: "No hay credenciales almacenadas para reautenticación automática"
- Error 401 se propaga normalmente

## Logs Importantes a Observar

### Login Exitoso
```
SIAAN login response: { message: 'Login exitoso', token: '...', tokenExpiry: '...' }
[Main] Credenciales almacenadas para reautenticación automática
```

### Primera Llamada API (Normal)
```
[API Interceptor] Ejecutando _obtenerPersonasPorCarnet (intento 1/2)
```

### Error 401 Detectado
```
[API Interceptor] Error capturado: { message: '...', status: 401, isAxiosError: true, hasResponse: true }
[API Interceptor] ⚠ Error 401 detectado (intento 1/2)
```

### Reautenticación en Progreso
```
[API Interceptor] Intentando reautenticación automática...
SIAAN login response: { message: 'Login exitoso', token: '...', tokenExpiry: '...' }
[API Interceptor] ✓ Reautenticación exitosa, reintentando llamada...
```

### Reintento Exitoso
```
[API Interceptor] Ejecutando _obtenerPersonasPorCarnet (intento 2/2)
[API Interceptor] ✓ Éxito después de reautenticación
```

## Verificación de Funcionalidad

### ✅ Lista de Verificación

- [ ] Login almacena credenciales correctamente
- [ ] Tokens se guardan en tokenStore
- [ ] APIs funcionan normalmente con tokens válidos
- [ ] Error 401 es detectado correctamente
- [ ] Reautenticación se ejecuta automáticamente
- [ ] Nuevos tokens se guardan después de reauth
- [ ] Operación original se reintenta exitosamente
- [ ] Usuario no ve errores durante reauth
- [ ] Logs completos en consola
- [ ] Funciona con todas las APIs (personas, kardex, pagos, etc.)

## Debugging

### Si la reautenticación no funciona:

1. **Verificar que las credenciales se almacenaron**:
   ```javascript
   // En apiInterceptor.js, después de setStoredCredentials:
   console.log('[API Interceptor] Credenciales almacenadas:', storedCredentials);
   ```

2. **Verificar detección de error 401**:
   ```javascript
   // En apiInterceptor.js, en isUnauthorizedError:
   console.log('[API Interceptor] Verificando error:', error);
   ```

3. **Verificar tokens después de reauth**:
   ```javascript
   // En tokenStore.js, en setExternalTokens:
   console.log('[TokenStore] Tokens actualizados:', externalTokens);
   ```

4. **Verificar axios config**:
   ```javascript
   // En personas.js, antes de axios.get:
   console.log('[Personas] Headers:', headers);
   ```

### Errores Comunes

| Error | Causa Probable | Solución |
|-------|----------------|----------|
| "No hay credenciales almacenadas" | Login no guardó credenciales | Verificar que setStoredCredentials se llame en main.js |
| Error 401 persiste después de reauth | Credenciales incorrectas | Verificar Email y ServiceCode |
| "Request failed with status code 401" | validateStatus no configurado | Verificar que axios tenga validateStatus en personas.js |
| Reauth se ejecuta pero falla | Token/UniqueCode no se actualizan | Verificar setExternalTokens en apiInterceptor |

## Prueba de Integración Completa

### Escenario Real

1. Usuario hace login a las 9:00 AM
2. Trabaja normalmente hasta las 11:00 AM
3. Token expira a las 11:30 AM
4. Usuario intenta buscar estudiante a las 11:35 AM
5. Sistema detecta 401, reautentica automáticamente
6. Búsqueda se completa exitosamente
7. Usuario continúa trabajando sin interrupción

**Duración de token típica**: Verificar headers `tokenExpiry` en la response de login

## Notas de Producción

- El sistema solo funciona si el usuario hizo login con credenciales válidas
- Las credenciales se almacenan en memoria (no persisten entre reinicios)
- El uniqueCode se regenera en cada reautenticación
- Solo se reintenta una vez por defecto (configurable)
- Los logs ayudan a diagnosticar problemas en producción

## Contacto de Soporte

Si encuentras problemas durante las pruebas:
1. Revisa los logs completos de la consola
2. Verifica la configuración de axios en personas.js
3. Confirma que main.js está guardando credenciales
4. Revisa el README_REAUTH.md para más detalles
