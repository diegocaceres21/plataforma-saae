import { Injectable, inject } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { ToastService } from './toast';
import { 
  Carrera, 
  ApoyoFamiliar, 
  Gestion, 
  Departamento, 
  Tarifario,
  Beneficio, 
  CampoConfiguracion, 
  TablaConfiguracion 
} from '../interfaces';

// Tipo genérico para todos los items de configuración
export type ConfigurationItem = Carrera | ApoyoFamiliar | Gestion | Departamento | Tarifario | Beneficio;

@Injectable({
  providedIn: 'root'
})
export class ConfiguracionService {
  private toastService = inject(ToastService);

  // Estado reactivo
  private _tablaActiva = new BehaviorSubject<string>('carreras');
  private _datos = new BehaviorSubject<Record<string, ConfigurationItem[]>>({
    carreras: [],
    apoyo_familiar: [],
    gestiones: [],
    departamentos: [],
    tarifario: [],
    beneficios: []
  });
  private _loading = new BehaviorSubject<boolean>(false);
  private _gestiones = new BehaviorSubject<Gestion[]>([]);

  // Observables públicos
  public readonly tablaActiva$ = this._tablaActiva.asObservable();
  public readonly datos$ = this._datos.asObservable();
  public readonly loading$ = this._loading.asObservable();
  public readonly gestiones$ = this._gestiones.asObservable();

  // Configuración de tablas
  private readonly configuracionTablas: Record<string, TablaConfiguracion> = {
    carreras: {
      id: 'carreras',
      nombre: 'Carreras',
      nombreSingular: 'Carrera',
      icono: '📚',
      campos: [
        { key: 'carrera', label: 'Nombre de la Carrera', type: 'text', required: true },
        { key: 'id_departamento', label: 'Departamento', type: 'select', required: true, options: [] },
        { key: 'id_tarifario', label: 'Tarifario', type: 'select', required: true, options: [] },
        { key: 'incluye_tecnologico', label: 'Incluye Tecnológico', type: 'checkbox', required: false },
        { key: 'visible', label: 'Visible', type: 'checkbox', required: false }
      ],
      itemVacio: { carrera: '', id_departamento: '', id_tarifario: '', incluye_tecnologico: false, visible: true },
      permisos: { crear: true, editar: true, eliminar: true }
    },
    apoyo_familiar: {
      id: 'apoyo_familiar',
      nombre: 'Apoyo Familiar',
      nombreSingular: 'Apoyo Familiar',
      icono: '💰',
      campos: [
        { key: 'orden', label: 'Orden', type: 'number', required: true, min: 0 },
        { key: 'porcentaje', label: 'Porcentaje (%)', type: 'number', required: true, min: 0, max: 100 },
      ],
      itemVacio: { porcentaje: 0, orden: 0 },
      permisos: { crear: true, editar: true, eliminar: false }
    },
    gestiones: {
      id: 'gestiones',
      nombre: 'Gestiones',
      nombreSingular: 'Gestión',
      icono: '📅',
      campos: [
        { key: 'gestion', label: 'Gestión', type: 'text', required: true },
        { key: 'anio', label: 'Año', type: 'number', required: true, min: 2000, max: 2100 },
        { key: 'tipo', label: 'Tipo', type: 'select', required: true, options: [
          { value: 'Anual', label: 'Anual' },
          { value: 'Semestre', label: 'Semestre' }
        ]},
        { key: 'id_gestion_siaan', label: 'ID Gestión SIAAN', type: 'text', required: true },

        { key: 'activo', label: 'Activo', type: 'checkbox', required: false },
        { key: 'visible', label: 'Visible', type: 'checkbox', required: false }
      ],
      itemVacio: { gestion: '', anio: new Date().getFullYear(), tipo: 'Semestre', activo: true, visible: true, id_gestion_siaan: ''},
      permisos: { crear: true, editar: true, eliminar: false }
    },
    departamentos: {
      id: 'departamentos',
      nombre: 'Departamentos',
      nombreSingular: 'Departamento',
      icono: '🏢',
      campos: [
        { key: 'departamento', label: 'Nombre del Departamento', type: 'text', required: true }
      ],
      itemVacio: { departamento: '' },
      permisos: { crear: true, editar: true, eliminar: true }
    },
    tarifario: {
      id: 'tarifario',
      nombre: 'Tarifario',
      nombreSingular: 'Tarifario',
      icono: '💳',
      campos: [
        { key: 'tarifario', label: 'Nombre del Tarifario', type: 'text', required: true },
        { key: 'valor_credito', label: 'Valor Crédito', type: 'number', required: true, min: 0, step: 0.01 },
        { key: 'visible', label: 'Visible', type: 'checkbox', required: false }
      ],
      itemVacio: { tarifario: '', valor_credito: 0, visible: true },
      permisos: { crear: true, editar: true, eliminar: true }
    },
    beneficios: {
      id: 'beneficios',
      nombre: 'Beneficios',
      nombreSingular: 'Beneficio',
      icono: '🎁',
      campos: [
        { key: 'nombre', label: 'Nombre del Beneficio', type: 'text', required: true },
        { key: 'tipo', label: 'Tipo', type: 'select', required: true, options: [
          { value: 'Beca', label: 'Beca' },
          { value: 'Descuento', label: 'Descuento' },
          { value: 'Apoyo', label: 'Apoyo' }
        ]},
        { key: 'porcentaje', label: 'Porcentaje (%)', type: 'number', required: false, min: 0, max: 100 },
        { key: 'limite_creditos', label: 'Límite de Créditos', type: 'number', required: false, min: 0, step: 1 }
      ],
      itemVacio: { nombre: '', tipo: 'Apoyo', porcentaje: 0, limite_creditos: 0 },
      permisos: { crear: true, editar: true, eliminar: true }
    }
  };

  constructor() {
    this.inicializar();
  }

  // Getters
  get tablaActiva(): string {
    return this._tablaActiva.value;
  }

  get datos(): Record<string, ConfigurationItem[]> {
    return this._datos.value;
  }

  get loading(): boolean {
    return this._loading.value;
  }

  get gestiones(): Gestion[] {
    return this._gestiones.value;
  }

  // Métodos públicos para obtener configuración
  getConfiguracionTabla(id: string): TablaConfiguracion | undefined {
    return this.configuracionTablas[id];
  }

  getConfiguracionTablaActiva(): TablaConfiguracion | undefined {
    return this.configuracionTablas[this.tablaActiva];
  }

  getCamposTablaActiva(): CampoConfiguracion[] {
    const config = this.getConfiguracionTablaActiva();
    if (!config) return [];
    
    // Retornar una copia profunda de los campos para evitar modificaciones accidentales
    return config.campos.map(campo => ({
      ...campo,
      options: campo.options ? [...campo.options] : undefined
    }));
  }

  getTablas(): TablaConfiguracion[] {
    return Object.values(this.configuracionTablas);
  }

  getDatosTablaActiva(): ConfigurationItem[] {
    return this.datos[this.tablaActiva] || [];
  }

  // Métodos de navegación
  cambiarTabla(tablaId: string): void {
    if (this.configuracionTablas[tablaId]) {
      this._tablaActiva.next(tablaId);
    }
  }

  // Inicialización
  private async inicializar(): Promise<void> {
    await this.cargarTodosLosDatos();
  }

  // Métodos de carga de datos
  async cargarTodosLosDatos(): Promise<void> {
    this._loading.next(true);
    try {
      const [carreras, apoyosFamiliares, gestiones, departamentos, tarifarios, beneficios] = await Promise.all([
        this.cargarCarreras(),
        this.cargarApoyosFamiliares(),
        this.cargarGestiones(),
        this.cargarDepartamentos(),
        this.cargarTarifarios(),
        this.cargarBeneficios()
      ]);

      const nuevoDatos = {
        carreras,
        apoyo_familiar: apoyosFamiliares,
        gestiones,
        departamentos,
        tarifario: tarifarios,
        beneficios
      };

      this._datos.next(nuevoDatos);
      this._gestiones.next(gestiones);
      
      // Actualizar opciones de select después de cargar los datos
      this.actualizarOpcionesSelect();
      
    } catch (error) {
      console.error('Error al cargar datos:', error);
      this.toastService.error('Error', 'No se pudieron cargar los datos de configuración');
    } finally {
      this._loading.next(false);
    }
  }

  // Método para actualizar las opciones de los campos select
  private actualizarOpcionesSelect(): void {
    const datos = this._datos.value;
    
    // Actualizar opciones para carreras
    if (this.configuracionTablas['carreras']) {
      const campoDepartamento = this.configuracionTablas['carreras'].campos.find(c => c.key === 'id_departamento');
      if (campoDepartamento && datos['departamentos']) {
        campoDepartamento.options = (datos['departamentos'] as Departamento[]).map(dep => ({
          value: dep.id,
          label: dep.departamento
        }));
      }
      
      const campoTarifario = this.configuracionTablas['carreras'].campos.find(c => c.key === 'id_tarifario');
      if (campoTarifario && datos['tarifario']) {
        campoTarifario.options = (datos['tarifario'] as Tarifario[]).map(tar => ({
          value: tar.id,
          label: `${tar.tarifario} (${tar.valor_credito} Bs.)`
        }));
      }
    }
    
    // Emitir cambio para notificar a los componentes
    this._tablaActiva.next(this._tablaActiva.value);
  }

  private async cargarCarreras(): Promise<Carrera[]> {
    try {
      if (!window.academicoAPI) throw new Error('API no disponible');
      return await window.academicoAPI.getAllCarrera();
    } catch (error) {
      console.error('Error al cargar carreras:', error);
      return [];
    }
  }

  private async cargarApoyosFamiliares(): Promise<ApoyoFamiliar[]> {
    try {
      if (!window.academicoAPI) throw new Error('API no disponible');
      return await window.academicoAPI.getAllApoyoFamiliar();
    } catch (error) {
      console.error('Error al cargar apoyos familiares:', error);
      return [];
    }
  }

  private async cargarGestiones(): Promise<Gestion[]> {
    try {
      if (!window.academicoAPI) throw new Error('API no disponible');
      return await window.academicoAPI.getAllGestion();
    } catch (error) {
      console.error('Error al cargar gestiones:', error);
      return [];
    }
  }

  private async cargarDepartamentos(): Promise<Departamento[]> {
    try {
      if (!window.academicoAPI) throw new Error('API no disponible');
      return await window.academicoAPI.getAllDepartamento();
    } catch (error) {
      console.error('Error al cargar departamentos:', error);
      return [];
    }
  }

  private async cargarTarifarios(): Promise<Tarifario[]> {
    try {
      if (!window.academicoAPI) throw new Error('API no disponible');
      return await window.academicoAPI.getAllTarifario();
    } catch (error) {
      console.error('Error al cargar tarifarios:', error);
      return [];
    }
  }

  private async cargarBeneficios(): Promise<Beneficio[]> {
    try {
      if (!window.academicoAPI) throw new Error('API no disponible');
      return await window.academicoAPI.getAllBeneficio();
    } catch (error) {
      console.error('Error al cargar beneficios:', error);
      return [];
    }
  }

  // Operaciones CRUD
  async crearItem(item: any): Promise<void> {
    if (!this.validarItem(item)) return;

    this._loading.next(true);
    try {
      if (!window.academicoAPI) throw new Error('API no disponible');

      switch (this.tablaActiva) {
        case 'carreras':
          await window.academicoAPI.createCarrera(item);
          break;
        case 'apoyo_familiar':
          await window.academicoAPI.createApoyoFamiliar(item);
          break;
        case 'gestiones':
          await window.academicoAPI.createGestion(item);
          break;
        case 'departamentos':
          await window.academicoAPI.createDepartamento(item);
          break;
        case 'tarifario':
          await window.academicoAPI.createTarifario(item);
          break;
        case 'beneficios':
          await window.academicoAPI.createBeneficio(item);
          break;
        default:
          throw new Error('Operación no soportada para esta tabla');
      }

      await this.recargarTablaActual();
      this.toastService.success('Éxito', 'Item creado correctamente', 3000);
    } catch (error) {
      console.error('Error al crear item:', error);
      this.toastService.error('Error', 'No se pudo crear el item');
      throw error;
    } finally {
      this._loading.next(false);
    }
  }

  async actualizarItem(id: string, item: any): Promise<void> {
    if (!this.validarItem(item)) return;

    const configuracion = this.getConfiguracionTablaActiva();
    if (!configuracion?.permisos.editar) {
      this.toastService.error('Error', `La edición de ${configuracion?.nombre.toLowerCase()} no está disponible`);
      return;
    }

    this._loading.next(true);
    try {
      if (!window.academicoAPI) throw new Error('API no disponible');

      switch (this.tablaActiva) {
        case 'carreras':
          await window.academicoAPI.updateCarrera(id, item);
          break;
        case 'apoyo_familiar':
          await window.academicoAPI.updateApoyoFamiliar(id, item);
          break;
        case 'gestiones':
          await window.academicoAPI.updateGestion(id, item);
          break;
        case 'departamentos':
          await window.academicoAPI.updateDepartamento(id, item);
          break;
        case 'tarifario':
          await window.academicoAPI.updateTarifario(id, item);
          break;
        case 'beneficios':
          await window.academicoAPI.updateBeneficio(id, item);
          break;
        default:
          throw new Error('Operación no soportada para esta tabla');
      }

      await this.recargarTablaActual();
      this.toastService.success('Éxito', 'Item actualizado correctamente', 3000);
    } catch (error) {
      console.error('Error al actualizar item:', error);
      this.toastService.error('Error', 'No se pudo actualizar el item');
      throw error;
    } finally {
      this._loading.next(false);
    }
  }

  async eliminarItem(id: string): Promise<void> {
    const configuracion = this.getConfiguracionTablaActiva();
    if (!configuracion?.permisos.eliminar) {
      this.toastService.error('Error', `La eliminación de ${configuracion?.nombre.toLowerCase()} no está disponible`);
      return;
    }

    this._loading.next(true);
    try {
      if (!window.academicoAPI) throw new Error('API no disponible');

      switch (this.tablaActiva) {
        case 'carreras':
          await window.academicoAPI.removeCarrera(id);
          break;
        case 'apoyo_familiar':
          await window.academicoAPI.removeApoyoFamiliar(id);
          break;
        case 'departamentos':
          await window.academicoAPI.removeDepartamento(id);
          break;
        case 'tarifario':
          await window.academicoAPI.removeTarifario(id);
          break;
        case 'beneficios':
          await window.academicoAPI.removeBeneficio(id);
          break;
        default:
          throw new Error('Operación no soportada para esta tabla');
      }

      await this.recargarTablaActual();
      this.toastService.success('Éxito', 'Item eliminado correctamente', 3000);
    } catch (error) {
      console.error('Error al eliminar item:', error);
      this.toastService.error('Error', 'No se pudo eliminar el item');
      throw error;
    } finally {
      this._loading.next(false);
    }
  }

  // Métodos auxiliares
  private validarItem(item: any): boolean {
    const configuracion = this.getConfiguracionTablaActiva();
    if (!configuracion) return false;

    for (const campo of configuracion.campos) {
      if (campo.required && (!item[campo.key] && item[campo.key] !== 0)) {
        this.toastService.error('Error', `El campo ${campo.label} es obligatorio`);
        return false;
      }
    }
    return true;
  }

  private async recargarTablaActual(): Promise<void> {
    const datosActuales = this._datos.value;
    
    try {
      switch (this.tablaActiva) {
        case 'carreras':
          datosActuales['carreras'] = await this.cargarCarreras();
          break;
        case 'apoyo_familiar':
          datosActuales['apoyo_familiar'] = await this.cargarApoyosFamiliares();
          break;
        case 'gestiones':
          const gestiones = await this.cargarGestiones();
          datosActuales['gestiones'] = gestiones;
          this._gestiones.next(gestiones);
          break;
        case 'departamentos':
          datosActuales['departamentos'] = await this.cargarDepartamentos();
          break;
        case 'tarifario':
          datosActuales['tarifario'] = await this.cargarTarifarios();
          break;
        case 'beneficios':
          datosActuales['beneficios'] = await this.cargarBeneficios();
          break;
      }
      
      this._datos.next(datosActuales);
      
      // Actualizar opciones select después de recargar
      this.actualizarOpcionesSelect();
    } catch (error) {
      console.error('Error al recargar datos:', error);
    }
  }

  // Métodos utilitarios para los componentes
  obtenerValorCampo(item: any, campo: string): any {
    const valor = item[campo];
    
    // Si es una foreign key, intentar resolver la relación
    if (this.tablaActiva === 'carreras') {
      if (campo === 'id_departamento' && valor) {
        const departamentos = this._datos.value['departamentos'] as Departamento[];
        const departamento = departamentos?.find(d => d.id === valor);
        return departamento ? departamento.departamento : valor;
      }
      
      if (campo === 'id_tarifario' && valor) {
        const tarifarios = this._datos.value['tarifario'] as Tarifario[];
        const tarifario = tarifarios?.find(t => t.id === valor);
        return tarifario ? `${tarifario.tarifario} (${tarifario.valor_credito} Bs.)` : valor;
      }
    }
    
    return valor;
  }

  obtenerNombreColumna(campo: string): string {
    const configuracion = this.getConfiguracionTablaActiva();
    const campoConfig = configuracion?.campos.find(c => c.key === campo);
    return campoConfig ? campoConfig.label : campo;
  }

  crearItemVacio(): any {
    const configuracion = this.getConfiguracionTablaActiva();
    return configuracion ? { ...configuracion.itemVacio } : {};
  }
}