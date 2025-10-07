# Build & Auto-Update Guide (Plataforma SAAE)

Este documento describe cómo generar instaladores, publicar releases y probar el sistema de auto-actualización usando electron-builder y electron-updater.

## 1. Requisitos Previos

1. Node.js y npm instalados.
2. Repositorio hospedado en GitHub (privado o público).
3. Token Personal de GitHub (Classic o Fine-Grained) con permisos `repo` (para repos privados) o al menos `public_repo` (si es público).
4. Añadir variable de entorno `GH_TOKEN` antes de ejecutar publicación.
   - Windows PowerShell: `setx GH_TOKEN "<TOKEN_AQUI>"` (luego abrir nueva terminal) o usar temporalmente: `$env:GH_TOKEN="<TOKEN_AQUI>"`.

## 2. Configuración en `package.json`

Se agregó un bloque `build` con:
- `appId`: Identificador único.
- `productName`: Nombre visible en instalador.
- `files`: Incluye el bundle Angular y archivos del backend Electron.
- `asar`: Empaqueta los recursos para evitar modificaciones accidentales.
- `publish`: Configurado para GitHub (coloca tu `owner` y `repo`).
- `nsis`: Configuración del instalador Windows (modo no one-click, permite elegir carpeta, etc.).

IMPORTANTE: Cambiar los placeholders `CHANGE_ME_OWNER` y `CHANGE_ME_REPO` en `package.json`.

## 3. Flujo de Build Local

1. Generar build Angular + Electron empaquetado:
   - `npm run electron:build`
2. Resultado: carpeta `dist/` contendrá artefactos y en `dist/*.exe` el instalador.
3. Probar instalador:
   - Ejecutar `.exe`, instalar en carpeta de pruebas.
   - Verificar: arranque, login, generación de PDF, acceso a endpoints.

## 4. Publicar Release (Auto-Update)

1. Asegurar versión nueva en `package.json` (incrementar semver: patch/minor/major).
2. Exportar token GitHub en la sesión (`$env:GH_TOKEN="..."`).
3. Ejecutar: `npm run electron:release`.
4. electron-builder creará un **draft release** (por `releaseType: draft`).
5. Revisar en GitHub → Releases → completar notas y publicar (Publish release).
6. El archivo `latest.yml` y el instalador `.exe` deben estar presentes en la release.

## 5. Probar Auto-Update

Escenario: tienes instalada la versión 0.1.0 y publicas 0.1.1.

1. Instalar versión antigua (0.1.0).
2. Subir nueva versión (0.1.1) a GitHub releases (publish).
3. Abrir la app instalada 0.1.0.
4. La app (tras ~3s) ejecuta `checkForUpdates()`. Eventos:
   - `update:available` → UI (puedes implementar un diálogo) pide descargar.
   - Llamar IPC `update:download` (necesitarás exponerlo vía preload si deseas UI).
   - Progreso: `update:download-progress`.
   - Final: `update:downloaded` → Llamar IPC `update:install`.
5. App se reinicia con la versión nueva.

Actualmente sólo el main process tiene la lógica; para mostrarlo en UI agrega en `preload.js` algo como:
```js
contextBridge.exposeInMainWorld('updater', {
  check: () => ipcRenderer.invoke('update:check'),
  download: () => ipcRenderer.invoke('update:download'),
  install: () => ipcRenderer.invoke('update:install'),
  on: (channel, cb) => ipcRenderer.on(channel, (_, data) => cb(data))
});
```
Y en tu Angular servicio suscribirte a esos eventos.

## 6. Buenas Prácticas de Versionado

- Incrementar versión antes de `electron:release`.
- Mantener CHANGELOG.md (opcional) para claridad de cambios.
- Evitar saltar versiones sin necesidad; sigue SemVer.

## 7. Iconos

Colocar tus iconos en `build/icons/`. Recomendaciones:
- `icon.png` (512x512)
- `icon.ico` multi-res (16, 32, 48, 64, 128, 256)

Puedes generar `.ico` desde `.png` con herramientas online o ImageMagick.

## 8. Troubleshooting

| Problema | Causa Probable | Solución |
|----------|----------------|----------|
| Auto-update no detecta versión nueva | Release no publicada o misma versión | Publicar release y aumentar versión |
| Error GH_TOKEN | Variable no exportada | Exportar GH_TOKEN antes de release |
| Instalador no crea acceso directo | Cambios en config NSIS | Revisar bloque `nsis` en package.json |
| No carga UI en producción | Ruta index errónea | Confirmar `dist/plataforma-saae/browser/index.html` |

## 9. Próximos Pasos (Opcionales)

- Agregar canal beta (usar `prerelease` y etiquetas).
- Firma de código para Windows (certificado EV/Code Signing) si distribución externa.
- Soporte multiplataforma (añadir targets mac, linux en build).
- Integrar diálogo amigable en Angular para descargar e instalar updates.

---

Cualquier duda adicional sobre este flujo se puede documentar aquí con ejemplos de UI.
