# Componente de Login y Autenticación Básica

Se agregó un flujo mínimo de autenticación para la plataforma.

## Archivos añadidos
- `src/app/componentes/auth/login/login.ts|html|scss`: Nuevo componente standalone `LoginComponent`.
- `src/app/servicios/auth.ts`: Servicio simple `AuthService` con `login`, `logout`, `isAuthenticated`.
- `src/app/servicios/auth-guard.ts`: Guard funcional `authGuard` para proteger rutas.
- Actualización de `app.routes.ts`: Nueva ruta `/login` y redirección inicial.

## Uso
1. Ir a `/login` para iniciar sesión.
2. Introducir usuario y contraseña (cualquier valor no vacío funciona en este stub).
3. Al enviar, se guarda `sessionStorage.auth = '1'` y se redirige a `/menu`.
4. Para cerrar sesión:
   ```ts
   import { AuthService } from './servicios/auth';
   constructor(private auth: AuthService) {}
   this.auth.logout();
   ```
   Luego redirigir manualmente a `/login`.

## Proteger rutas
Ejemplo para proteger `menu` (modificar en `app.routes.ts`):
```ts
import { authGuard } from './servicios/auth-guard';
{
  path: 'menu',
  component: Menu,
  canActivate: [authGuard]
}
```

## Mejoras futuras sugeridas
- Reemplazar stub de login por llamada HTTP a backend.
- Manejo de roles/permisos.
- Refresh tokens / expiración.
- Interceptor HTTP para adjuntar token.
- Página de recuperación de contraseña.

## Logo
El login reutiliza `logo.png` igual que el menú (`public/logo.png`). Ajustar tamaño en `login.html` o `login.scss` según necesidad.

## Autenticación real (JWT + bcrypt)
Se agregó backend con:
- Tabla `usuario` (script: `electron-backend/sql/create_users.sql`).
- Hash bcrypt (`bcryptjs`) y emisión de JWT (expira en 8h).
- Rutas IPC: `auth:login`, `auth:verify`.
- Frontend: `AuthService` guarda `{token,user,exp}` en `sessionStorage`.
- Guard `auth-guard.ts` verifica sesión y opcionalmente valida contra backend.

### Crear tabla y usuario inicial
Ejecutar en PostgreSQL:
```sql
\i electron-backend/sql/create_users.sql
```
Credenciales iniciales: `admin / admin123` (cambiar en producción).

### Variables de entorno
Agregar en `.env` (crear si no existe en raíz):
```
JWT_SECRET=una_clave_segura_larga
```

### Flujo de login
1. Usuario ingresa credenciales.
2. IPC `auth:login` valida y retorna token.
3. Se almacena en `sessionStorage` bajo clave `auth_jwt`.
4. Guard protege rutas aplicando `canActivate: [authGuard]`.
5. `logout()` elimina el token.

### Registro de usuario (IPC `auth:register`)
Disponible para crear nuevos usuarios:
```ts
window.authAPI?.register({ username: 'nuevo', password: 'secreto123', rol: 'admin' })
  .then(r => console.log(r));
```
Respuesta exitosa: `{ user: { id, username, rol, created_at } }`

Validaciones:
- username único (3-60 caracteres)
- password mínimo 6 caracteres
- rol opcional (default: 'usuario')

Errores comunes:
- `username ya existe`
- `password demasiado corto`
- `username demasiado corto`

### Login externo SIAAN (IPC `api:logInSiaan`)
Permite obtener token del backend institucional:
```ts
window.academicoAPI?.logInSiaan({ email: 'usuario@ucb.edu.bo', password: 'Secreta123' })
  .then(r => console.log(r));
// Respuesta esperada: { message: 'Login exitoso', token: '...', tokenExpiry: '...' }
```
Notas:
- El endpoint externo devuelve headers `token` y `tokenexpiry` que se exponen en la respuesta.
- Manejar almacenamiento seguro según necesidad (no se guarda automáticamente).
- En caso de error: `{ error: 'mensaje' }`.

### Integración automática con SIAAN tras login interno
Desde la actualización reciente, el método `AuthService.login()` intenta automáticamente:
1. Autenticar localmente (JWT interno).
2. Llamar a `logInSiaan` con `{ email: username, password }`.
3. Si es exitoso, guarda en `sessionStorage.auth_jwt` los campos:
   - `siaanToken`
   - `siaanTokenExpiry`

Si SIAAN falla, el login interno continúa y se expone `siaanError` en la respuesta del método para mostrar advertencia no bloqueante.

### Tokens dinámicos para APIs externas
Ahora los headers `Token` y `Uniquecode` de peticiones a endpoints externos (como Personas/Kardex) ya no dependen de `process.env`, sino del almacén en memoria del proceso principal (`tokenStore.js`).

Flujo:
1. `AuthService.login()` genera un `uniqueCode` aleatorio y ejecuta `logInSiaan`.
2. Si es exitoso, invoca `academicoAPI.setExternalTokens({ token, uniqueCode, tokenExpiry })`.
3. `tokenStore` guarda los valores.
4. `externalApi/personas.js` construye los headers dinámicamente con `getExternalTokens()`.

Ventajas:
- Permite rotación sin reiniciar la app.
- Evita exponer credenciales estáticas empaquetadas.

Para forzar actualización manual (ejemplo en consola renderer):
```ts
window.academicoAPI.setExternalTokens({ token: 'nuevoToken', uniqueCode: 'nuevoCodigo' });
```

Ejemplo:
```ts
const res = await auth.login(user, pass);
if (res.success) {
  if (res.siaanError) console.warn('SIAAN parcial:', res.siaanError);
}
```

### Proteger rutas (ejemplo)
```ts
import { authGuard } from './servicios/auth-guard';
{ path: 'menu', component: Menu, canActivate: [authGuard] }
```

### Cerrar sesión desde un componente
```ts
constructor(private auth: AuthService, private router: Router) {}
salir() { this.auth.logout(); this.router.navigate(['/login']); }
```

### Verificación silenciosa
`auth.verifyServer()` puede llamarse en background para invalidar tokens expirados anticipadamente.

### Seguridad recomendada
- Cambiar inmediatamente el password inicial.
- Rotar `JWT_SECRET` periódicamente.
- Implementar límite de intentos (rate limiting) si se expone fuera del entorno controlado.
- Migrar a HTTPS/WebSocket seguro si se desacopla de Electron.
