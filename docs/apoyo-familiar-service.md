# Servicio Global de Apoyo Familiar

Este servicio proporciona acceso global a los datos de la tabla `apoyo_familiar` en toda la aplicación.

## 🚀 Configuración Automática

Los datos se cargan automáticamente al iniciar la aplicación en `app.ts`. No necesitas hacer nada especial para inicializar el servicio.

## 📖 Uso Básico

### 1. Inyectar el Servicio

```typescript
import { Component, inject } from '@angular/core';
import { ApoyoFamiliarService } from '../servicios/apoyo-familiar.service';

@Component({
  // ...
})
export class MiComponente {
  private apoyoFamiliarService = inject(ApoyoFamiliarService);
}
```

### 2. Acceso Directo a los Datos

```typescript
// Obtener todos los datos actuales
const todosLosDatos = this.apoyoFamiliarService.currentData;

// Verificar si está cargando
const estaCargando = this.apoyoFamiliarService.isLoading;

// Verificar si hay errores
const tieneError = this.apoyoFamiliarService.hasError;
```

### 3. Suscribirse a Cambios (Recomendado)

```typescript
import { OnInit, OnDestroy } from '@angular/core';
import { Subscription } from 'rxjs';

export class MiComponente implements OnInit, OnDestroy {
  private subscription = new Subscription();
  public apoyoFamiliarData: ApoyoFamiliar[] = [];

  ngOnInit() {
    // Suscribirse a cambios en los datos
    this.subscription.add(
      this.apoyoFamiliarService.apoyoFamiliarData$.subscribe(data => {
        this.apoyoFamiliarData = data;
      })
    );

    // Suscribirse al estado de carga
    this.subscription.add(
      this.apoyoFamiliarService.isLoading$.subscribe(loading => {
        console.log('Cargando:', loading);
      })
    );

    // Suscribirse a errores
    this.subscription.add(
      this.apoyoFamiliarService.error$.subscribe(error => {
        if (error) {
          console.error('Error:', error);
        }
      })
    );
  }

  ngOnDestroy() {
    this.subscription.unsubscribe();
  }
}
```

### 4. Uso en Templates con AsyncPipe

```html
<!-- Mostrar estado de carga -->
@if (apoyoFamiliarService.isLoading$ | async) {
  <div>Cargando datos...</div>
}

<!-- Mostrar errores -->
@if (apoyoFamiliarService.error$ | async; as error) {
  <div class="error">Error: {{error}}</div>
}

<!-- Mostrar datos -->
@if (apoyoFamiliarService.apoyoFamiliarData$ | async; as data) {
  @for (item of data; track item.id) {
    <div>{{item.porcentaje}}% - Orden: {{item.orden}}</div>
  }
}
```

## 🔧 Métodos Disponibles

### Obtener Datos Específicos

```typescript
// Buscar por ID
const item = this.apoyoFamiliarService.getApoyoFamiliarById('123');

// Buscar por orden
const item = this.apoyoFamiliarService.getApoyoFamiliarByOrden(1);

// Obtener todos los porcentajes
const porcentajes = this.apoyoFamiliarService.getAllPorcentajes();
```

### Operaciones de Actualización

```typescript
// Refrescar datos desde la base de datos
await this.apoyoFamiliarService.refreshData();

// Reset del servicio (útil para testing)
this.apoyoFamiliarService.reset();
```

## 📊 Propiedades Observables

- `apoyoFamiliarData$`: Observable<ApoyoFamiliar[]> - Los datos actuales
- `isLoading$`: Observable<boolean> - Estado de carga
- `error$`: Observable<string | null> - Errores si los hay

## 📋 Propiedades de Solo Lectura

- `currentData`: ApoyoFamiliar[] - Datos actuales (no observable)
- `isLoading`: boolean - Estado de carga actual
- `hasError`: boolean - Si hay error actual

## 🎯 Casos de Uso Comunes

### 1. Mostrar Opciones en un Select

```typescript
export class FormComponent {
  private apoyoFamiliarService = inject(ApoyoFamiliarService);
  
  get opcionesApoyo() {
    return this.apoyoFamiliarService.currentData.map(item => ({
      value: item.id,
      label: `${item.porcentaje}%`,
      orden: item.orden
    }));
  }
}
```

```html
<select>
  @for (opcion of opcionesApoyo; track opcion.value) {
    <option [value]="opcion.value">{{opcion.label}}</option>
  }
</select>
```

### 2. Validar Porcentaje Existe

```typescript
validarPorcentaje(porcentaje: number): boolean {
  return this.apoyoFamiliarService.getAllPorcentajes().includes(porcentaje);
}
```

### 3. Obtener Siguiente Orden Disponible

```typescript
getSiguienteOrden(): number {
  const ordenes = this.apoyoFamiliarService.currentData.map(item => item.orden);
  return Math.max(...ordenes, 0) + 1;
}
```

## ⚠️ Consideraciones Importantes

1. **Carga Inicial**: Los datos se cargan automáticamente al iniciar la app
2. **Estado Global**: Los datos están disponibles en toda la aplicación
3. **Reactividad**: Usa observables para reaccionar a cambios
4. **Manejo de Errores**: El servicio maneja errores gracefully
5. **Performance**: Los datos se mantienen en memoria para acceso rápido

## 🔄 Flujo de Datos

```
App Start → ApoyoFamiliarService.loadApoyoFamiliarData() 
         → Database Query (apoyo_familiar:getAll)
         → Update BehaviorSubjects
         → Components Receive Data via Observables
```

## 🧪 Testing

```typescript
// En tus tests, puedes mockear el servicio
const mockApoyoFamiliarService = {
  currentData: mockData,
  isLoading: false,
  hasError: false,
  apoyoFamiliarData$: of(mockData),
  isLoading$: of(false),
  error$: of(null)
};
```