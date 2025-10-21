import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { BaseChartDirective } from 'ng2-charts';
import { 
  Chart, 
  ChartConfiguration, 
  ChartOptions, 
  ChartType,
  CategoryScale,
  LinearScale,
  BarElement,
  BarController,
  LineElement,
  LineController,
  PointElement,
  Tooltip,
  Legend,
  Filler
} from 'chart.js';
import * as XLSX from 'xlsx';
import { MultiSelectDropdownComponent, MultiSelectOption } from '../../../../shared/componentes/multi-select-dropdown/multi-select-dropdown';
import { Gestion } from '../../../interfaces/gestion';
import { RouterLink } from "@angular/router";

// Registrar componentes necesarios de Chart.js
Chart.register(
  CategoryScale,
  LinearScale,
  BarElement,
  BarController,
  LineElement,
  LineController,
  PointElement,
  Tooltip,
  Legend,
  Filler
);

interface BeneficioData {
  nombre: string;
  tipo: string;
  totalEstudiantes: number;
  totalAhorro: number;
  color: string;
}

interface CarreraData {
  nombre: string;
  totalEstudiantes: number;
  totalAhorro: number;
  color: string;
  beneficios?: { [key: string]: { estudiantes: number; ahorro: number } }; // Datos por beneficio
}

interface EvolucionGestionData {
  gestion: string;
  [beneficio: string]: number | string; // nombre del beneficio como clave y monto como valor
}

interface ReporteBackendData {
  tipo: string;
  beneficio: string;
  carrera: string;
  estudiantes_total: string;
  descuento_total: string;
}

interface EvolucionBackendData {
  gestion: string;
  beneficio: string;
  estudiantes_total: string;
  descuento_total: string;
}

@Component({
  selector: 'app-reporte-beneficios',
  standalone: true,
  imports: [CommonModule, FormsModule, BaseChartDirective, MultiSelectDropdownComponent, RouterLink],
  templateUrl: './reporte-beneficios.html',
  styleUrl: './reporte-beneficios.scss'
})
export class ReporteBeneficios implements OnInit {
  // Filtros
  gestionSeleccionada: string = '';
  gestiones: Gestion[] = [];
  beneficiosFiltroSeleccionados: string[] = [];
  beneficioOptions: MultiSelectOption[] = [];

  // Métricas principales (para las tarjetas - sin filtros)
  totalEstudiantes: number = 0;
  totalAhorro: number = 0;
  
  // Totales originales (sin filtros)
  totalEstudiantesOriginal: number = 0;
  totalAhorroOriginal: number = 0;

  // Totales de carreras (afectados por filtros)
  totalEstudiantesCarreras: number = 0;
  totalAhorroCarreras: number = 0;

  // Datos para gráficos
  beneficiosData: BeneficioData[] = [];
  carrerasData: CarreraData[] = [];
  carrerasDataOriginal: CarreraData[] = [];
  evolucionData: EvolucionGestionData[] = [];

  // Datos separados por tipo de beneficio
  apoyosData: BeneficioData[] = [];
  becasData: BeneficioData[] = [];
  incentivosData: BeneficioData[] = [];

  // Estados
  isLoading: boolean = false;

  // Configuración para Chart de Estudiantes por Carrera
  public barChartTypeEstudiantes: ChartType = 'bar';
  public barChartDataEstudiantes: ChartConfiguration<'bar'>['data'] = {
    labels: [],
    datasets: [{
      label: 'Estudiantes',
      data: [],
      backgroundColor: [],
      borderColor: [],
      borderWidth: 2,
      borderRadius: 8,
      borderSkipped: false,
    }]
  };
  public barChartOptionsEstudiantes: ChartOptions<'bar'> = {
    responsive: true,
    maintainAspectRatio: false,
    indexAxis: 'x',
    plugins: {
      legend: {
        display: false
      },
      tooltip: {
         backgroundColor: '#fde047', // Amarillo UCB
        titleColor: '#003B71', // Azul UCB para el título
        bodyColor: '#003B71', // Azul UCB para el cuerpo
        padding: 12,
        titleFont: {
          size: 13,
          weight: 'bold'
        },
        bodyFont: {
          size: 14
        },
        callbacks: {
          label: (context) => {
            const value = context.parsed.y || 0;
            const total = this.totalEstudiantes;
            const percentage = total > 0 ? ((value / total) * 100).toFixed(1) : '0.0';
            return `${value} estudiantes (${percentage}%)`;
          }
        }
      }
    },
    scales: {
      y: {
        beginAtZero: true,
        ticks: {
          font: {
            size: 11,
            weight: 'bold'
          },
          color: '#9ca3af'
        },
        grid: {
          color: '#e2e8f0',
        },
        border: {
          width: 2,
          color: '#e5e7eb'
        }
      },
      x: {
        ticks: {
          font: {
            size: 10,
            weight: 600
          },
          color: '#9ca3af',
          maxRotation: 90,
          minRotation: 45,
          autoSkip: false
        },
        grid: {
          display: false
        },
        border: {
          width: 2,
          color: '#e5e7eb'
        }
      }
    }
  };

  // Configuración para Chart de Ahorro por Carrera
  public barChartTypeAhorro: ChartType = 'bar';
  public barChartDataAhorro: ChartConfiguration<'bar'>['data'] = {
    labels: [],
    datasets: [{
      label: 'Ahorro',
      data: [],
      backgroundColor: [],
      borderColor: [],
      borderWidth: 2,
      borderRadius: 8,
      borderSkipped: false,
    }]
  };
  public barChartOptionsAhorro: ChartOptions<'bar'> = {
    responsive: true,
    maintainAspectRatio: false,
    indexAxis: 'x',
    plugins: {
      legend: {
        display: false
      },
      tooltip: {
        backgroundColor: '#fde047', // Amarillo UCB
        titleColor: '#003B71', // Azul UCB para el título
        bodyColor: '#003B71', // Azul UCB para el cuerpo
        padding: 12,
        titleFont: {
          size: 13,
          weight: 'bold'
        },
        bodyFont: {
          size: 14
        },
        callbacks: {
          label: (context) => {
            const value = context.parsed.y || 0;
            const total = this.totalAhorro;
            const percentage = total > 0 ? ((value / total) * 100).toFixed(1) : '0.0';
            return `${this.formatCurrency(value)} (${percentage}%)`;
          }
        }
      }
    },
    scales: {
      y: {
        beginAtZero: true,
        ticks: {
          font: {
            size: 11,
            weight: 'bold'
          },
          color: '#9ca3af',
          callback: (value) => {
            return 'Bs. ' + Number(value).toLocaleString('es-BO', {
              minimumFractionDigits: 0,
              maximumFractionDigits: 0
            });
          }
        },
        grid: {
          color: '#e2e8f0',
        },
        border: {
          width: 2,
          color: '#e5e7eb'
        }
      },
      x: {
        ticks: {
          font: {
            size: 10,
            weight: 600
          },
          color: '#9ca3af',
          maxRotation: 90,
          minRotation: 45,
          autoSkip: false
        },
        grid: {
          display: false
        },
        border: {
          width: 2,
          color: '#e5e7eb'
        }
      }
    }
  };

  // Configuración para Chart de Evolución por Gestión
  public lineChartType: ChartType = 'line';
  public lineChartData: ChartConfiguration<'line'>['data'] = {
    labels: [],
    datasets: []
  };
  public lineChartOptions: ChartOptions<'line'> = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: {
      mode: 'index',
      intersect: false,
    },
    plugins: {
      legend: {
        display: true,
        position: 'bottom',
        labels: {
          font: {
            size: 12,
            weight: 'bold'
          },
          color: '#003B71',
          padding: 15,
          usePointStyle: true,
          pointStyle: 'circle'
        }
      },
      tooltip: {
        backgroundColor: '#003B71',
        titleColor: '#FDB913',
        bodyColor: '#ffffff',
        padding: 12,
        titleFont: {
          size: 13,
          weight: 'bold'
        },
        bodyFont: {
          size: 12
        },
        callbacks: {
          label: (context) => {
            const label = context.dataset.label || '';
            const value = context.parsed.y || 0;
            return `${label}: Bs. ${value.toLocaleString('es-BO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
          }
        }
      }
    },
    scales: {
      y: {
        beginAtZero: true,
        ticks: {
          font: {
            size: 11,
            weight: 'bold'
          },
          color: '#64748b',
          callback: function(value) {
            return 'Bs. ' + Number(value).toLocaleString('es-BO');
          }
        },
        grid: {
          color: '#e2e8f0',
        },
        border: {
          width: 2,
          color: '#cbd5e1'
        }
      },
      x: {
        ticks: {
          font: {
            size: 12,
            weight: 600
          },
          color: '#64748b'
        },
        grid: {
          display: false
        },
        border: {
          width: 2,
          color: '#cbd5e1'
        }
      }
    }
  };

  constructor() {}

  ngOnInit(): void {
    this.loadGestiones();
  }

  private async loadGestiones(): Promise<void> {
    try {
      // Llamar directamente al endpoint de gestiones de semestre
      if (!window.academicoAPI?.getSemesterGestion) {
        throw new Error('API getSemesterGestion no disponible');
      }

      const data: Gestion[] = await window.academicoAPI.getSemesterGestion();
      this.gestiones = data;
      
      // Cargar datos de evolución SOLO UNA VEZ al inicio (independiente de la gestión seleccionada)
      await this.loadEvolucionData();
      
      // Seleccionar la gestión más reciente por defecto
      if (this.gestiones.length > 0) {
        this.gestionSeleccionada = this.gestiones[0].id;
        // Cargar datos de la gestión seleccionada
        await this.loadData();
      }
    } catch (error) {
      console.error('Error loading gestiones:', error);
      this.gestiones = [];
    }
  }

  private async loadEvolucionData(): Promise<void> {
    try {
      if (!window.academicoAPI?.getEvolucionBeneficios) {
        throw new Error('API getEvolucionBeneficios no disponible');
      }

      const evolucionRawData = await window.academicoAPI.getEvolucionBeneficios();
      this.processEvolucionData(evolucionRawData);
      
      // Renderizar el gráfico de evolución solo una vez
      this.updateEvolucionChart();
    } catch (error) {
      console.error('Error loading evolución data:', error);
      this.evolucionData = [];
    }
  }

  private async loadData(): Promise<void> {
    if (!this.gestionSeleccionada) {
      console.warn('No hay gestión seleccionada');
      return;
    }

    this.isLoading = true;

    try {
      // Verificar que la API esté disponible
      if (!window.academicoAPI?.getReporteBeneficiosByGestion) {
        throw new Error('API de reportes no disponible');
      }

      // Obtener solo datos de la gestión seleccionada (NO evolución)
      const rawData: ReporteBackendData[] = await window.academicoAPI.getReporteBeneficiosByGestion(this.gestionSeleccionada);
      
      // Procesar los datos
      this.processReporteData(rawData);
      
      // Calcular métricas y actualizar gráficos (excepto evolución)
      this.calculateMetrics();
      this.aplicarFiltroCarreras();
      this.updateChartData();
      
    } catch (error) {
      console.error('Error loading reporte data:', error);
      // En caso de error, inicializar con datos vacíos
      this.beneficiosData = [];
      this.carrerasData = [];
      this.carrerasDataOriginal = [];
      this.totalEstudiantes = 0;
      this.totalAhorro = 0;
      this.totalEstudiantesCarreras = 0;
      this.totalAhorroCarreras = 0;
    } finally {
      this.isLoading = false;
    }
  }

  private processReporteData(rawData: ReporteBackendData[]): void {
    // Paleta de colores UCB
    const coloresUCB = [
      '#003B71', '#FDB913', '#005A9C', '#F7931E', '#00518F',
      '#FCBF49', '#004A7C', '#FFA500', '#0066A1', '#FFD700'
    ];

    // 1. Procesar datos de beneficios
    const beneficiosMap = new Map<string, { tipo: string; estudiantes: number; ahorro: number }>();
    
    rawData.forEach(row => {
      const beneficio = row.beneficio;
      const tipo = row.tipo;
      const estudiantes = parseInt(row.estudiantes_total);
      const ahorro = parseFloat(row.descuento_total);

      if (!beneficiosMap.has(beneficio)) {
        beneficiosMap.set(beneficio, { tipo, estudiantes: 0, ahorro: 0 });
      }

      const beneficioData = beneficiosMap.get(beneficio)!;
      beneficioData.estudiantes += estudiantes;
      beneficioData.ahorro += ahorro;
    });

    this.beneficiosData = Array.from(beneficiosMap.entries()).map(([nombre, data], index) => ({
      nombre,
      tipo: data.tipo,
      totalEstudiantes: data.estudiantes,
      totalAhorro: data.ahorro,
      color: coloresUCB[index % coloresUCB.length]
    }));

    // Ordenar por total de estudiantes descendente
    this.beneficiosData.sort((a, b) => b.totalEstudiantes - a.totalEstudiantes);

    // Separar beneficios por tipo
    this.apoyosData = this.beneficiosData.filter(b => b.tipo === 'Apoyo').sort((a, b) => b.totalEstudiantes - a.totalEstudiantes);
    this.becasData = this.beneficiosData.filter(b => b.tipo === 'Beca').sort((a, b) => b.totalEstudiantes - a.totalEstudiantes);
    this.incentivosData = this.beneficiosData.filter(b => b.tipo === 'Incentivo').sort((a, b) => b.totalEstudiantes - a.totalEstudiantes);

    // Inicializar opciones del multi-select
    this.beneficioOptions = this.beneficiosData.map(b => ({
      value: b.nombre,
      label: b.nombre
    }));

    // 2. Procesar datos de carreras con desglose por beneficio
    const carrerasMap = new Map<string, {
      estudiantes: number;
      ahorro: number;
      beneficios: { [key: string]: { estudiantes: number; ahorro: number } };
    }>();

    rawData.forEach(row => {
      const carrera = row.carrera;
      const beneficio = row.beneficio;
      const estudiantes = parseInt(row.estudiantes_total);
      const ahorro = parseFloat(row.descuento_total);

      if (!carrerasMap.has(carrera)) {
        carrerasMap.set(carrera, { estudiantes: 0, ahorro: 0, beneficios: {} });
      }

      const carreraData = carrerasMap.get(carrera)!;
      carreraData.estudiantes += estudiantes;
      carreraData.ahorro += ahorro;

      // Agregar desglose por beneficio
      if (!carreraData.beneficios[beneficio]) {
        carreraData.beneficios[beneficio] = { estudiantes: 0, ahorro: 0 };
      }
      carreraData.beneficios[beneficio].estudiantes += estudiantes;
      carreraData.beneficios[beneficio].ahorro += ahorro;
    });

    this.carrerasData = Array.from(carrerasMap.entries()).map(([nombre, data], index) => ({
      nombre,
      totalEstudiantes: data.estudiantes,
      totalAhorro: data.ahorro,
      color: coloresUCB[index % coloresUCB.length],
      beneficios: data.beneficios
    }));

    // Ordenar por total de estudiantes descendente
    this.carrerasData.sort((a, b) => b.totalEstudiantes - a.totalEstudiantes);

    // Guardar copia original para filtrado
    this.carrerasDataOriginal = JSON.parse(JSON.stringify(this.carrerasData));
    
    // Guardar totales originales
    this.totalEstudiantesOriginal = this.carrerasData.reduce((sum, c) => sum + c.totalEstudiantes, 0);
    this.totalAhorroOriginal = this.carrerasData.reduce((sum, c) => sum + c.totalAhorro, 0);
  }

  private processEvolucionData(rawData: EvolucionBackendData[]): void {
    // Agrupar datos por gestión
    const gestionesMap = new Map<string, { [beneficio: string]: number }>();
    
    rawData.forEach(row => {
      const gestion = row.gestion;
      const beneficio = row.beneficio;
      const descuento = parseFloat(row.descuento_total);

      if (!gestionesMap.has(gestion)) {
        gestionesMap.set(gestion, {});
      }

      const gestionData = gestionesMap.get(gestion)!;
      gestionData[beneficio] = descuento;
    });

    // Convertir a array y ordenar por gestión
    this.evolucionData = Array.from(gestionesMap.entries()).map(([gestion, beneficios]) => ({
      gestion,
      ...beneficios
    }));

    // Ordenar por gestión (cronológicamente)
    this.evolucionData.sort((a, b) => a.gestion.localeCompare(b.gestion));

  }

  private updateChartData(): void {
    // Ordenar carreras por total de estudiantes para el gráfico de estudiantes
    const carrerasOrdenadasPorEstudiantes = [...this.carrerasData].sort((a, b) => b.totalEstudiantes - a.totalEstudiantes);
    
    // Actualizar datos del gráfico de estudiantes
    this.barChartDataEstudiantes = {
      labels: carrerasOrdenadasPorEstudiantes.map(c => c.nombre),
      datasets: [{
        label: 'Estudiantes',
        data: carrerasOrdenadasPorEstudiantes.map(c => c.totalEstudiantes),
        backgroundColor: '#003B71',
        borderWidth: 2,
        borderRadius: 8,
        borderSkipped: false,
      }]
    };

    // Ordenar carreras por total de ahorro para el gráfico de ahorro
    const carrerasOrdenadasPorAhorro = [...this.carrerasData].sort((a, b) => b.totalAhorro - a.totalAhorro);
    
    // Actualizar datos del gráfico de ahorro
    this.barChartDataAhorro = {
      labels: carrerasOrdenadasPorAhorro.map(c => c.nombre),
      datasets: [{
        label: 'Ahorro',
        data: carrerasOrdenadasPorAhorro.map(c => c.totalAhorro),
        backgroundColor: "#003B71",
        borderWidth: 2,
        borderRadius: 7,
        borderSkipped: false,
      }]
    };

    // NO actualizar el gráfico de evolución aquí - se actualiza solo una vez al inicio
  }

  private updateEvolucionChart(): void {
    if (this.evolucionData.length === 0) return;
    
    console.log('Datos de evolución:', this.evolucionData);
    
    const gestiones = this.evolucionData.map(d => d.gestion);
    
    // Obtener todos los beneficios únicos de evolucionData (excluyendo 'gestion')
    const beneficiosSet = new Set<string>();
    this.evolucionData.forEach(row => {
      Object.keys(row).forEach(key => {
        if (key !== 'gestion') {
          beneficiosSet.add(key);
        }
      });
    });
    
    const beneficios = Array.from(beneficiosSet);
    const colores = ['#003B71', '#FDB913', '#005A9C', '#F7931E', '#00518F'];
    
    // Crear datasets usando solo evolucionData
    const datasets = beneficios.map((beneficio, index) => {
      return {
        label: beneficio,
        data: this.evolucionData.map(d => d[beneficio] as number || 0),
        borderColor: colores[index % colores.length],
        backgroundColor: colores[index % colores.length],
        borderWidth: 3,
        tension: 0.4,
        pointRadius: 5,
        pointHoverRadius: 7,
        pointBackgroundColor: '#ffffff',
        pointBorderWidth: 2,
        pointHoverBorderWidth: 3,
        fill: false
      };
    });

    this.lineChartData = {
      labels: gestiones,
      datasets: datasets
    };

    console.log('Gráfico de evolución configurado:', this.lineChartData);
  }

  private calculateMetrics(): void {
    // Calcular totales de beneficios (estos no cambian con filtros de carreras)
    const totalEstudiantesBeneficios = this.beneficiosData.reduce((sum, b) => sum + b.totalEstudiantes, 0);
    const totalAhorroBeneficios = this.beneficiosData.reduce((sum, b) => sum + b.totalAhorro, 0);
    
    // Inicializar totales con los valores de carreras originales
    this.totalEstudiantes = this.totalEstudiantesOriginal || totalEstudiantesBeneficios;
    this.totalAhorro = this.totalAhorroOriginal || totalAhorroBeneficios;
  }

  onGestionChange(): void {
    // Recargar datos cuando cambia la gestión
    this.loadData();
  }

  // Método de filtrado con multi-select
  onBeneficioFilterChange(selectedValues: string[]): void {
    this.beneficiosFiltroSeleccionados = selectedValues;
    this.aplicarFiltroCarreras();
  }

  private aplicarFiltroCarreras(): void {
    if (this.beneficiosFiltroSeleccionados.length === 0) {
      // Sin filtros, mostrar todos los datos ordenados por total de estudiantes (descendente)
      this.carrerasData = [...this.carrerasDataOriginal].sort((a, b) => b.totalEstudiantes - a.totalEstudiantes);
    } else {
      // Filtrar y recalcular totales por carrera según los beneficios seleccionados
      this.carrerasData = this.carrerasDataOriginal.map(carrera => {
        if (!carrera.beneficios) return carrera;

        let totalEstudiantes = 0;
        let totalAhorro = 0;

        this.beneficiosFiltroSeleccionados.forEach(beneficio => {
          if (carrera.beneficios && carrera.beneficios[beneficio]) {
            totalEstudiantes += carrera.beneficios[beneficio].estudiantes;
            totalAhorro += carrera.beneficios[beneficio].ahorro;
          }
        });

        return {
          ...carrera,
          totalEstudiantes,
          totalAhorro
        };
      })
      .filter(c => c.totalEstudiantes > 0 || c.totalAhorro > 0)
      .sort((a, b) => b.totalEstudiantes - a.totalEstudiantes); // Ordenar de mayor a menor por estudiantes
    }
    
    // Calcular totales de carreras (estos SÍ se ven afectados por filtros)
    this.totalEstudiantesCarreras = this.carrerasData.reduce((sum, c) => sum + c.totalEstudiantes, 0);
    this.totalAhorroCarreras = this.carrerasData.reduce((sum, c) => sum + c.totalAhorro, 0);
    
    // Actualizar solo los gráficos, NO las tarjetas principales
    this.updateChartData();
  }

  // Helpers para gráficos de barras horizontales
  getMaxValue(type: 'estudiantes' | 'ahorro'): number {
    if (type === 'estudiantes') {
      return Math.max(...this.beneficiosData.map(b => b.totalEstudiantes));
    } else {
      return Math.max(...this.beneficiosData.map(b => b.totalAhorro));
    }
  }

  // Helpers para obtener máximos por tipo
  getMaxValueByTipo(data: BeneficioData[], type: 'estudiantes' | 'ahorro'): number {
    if (data.length === 0) return 0;
    if (type === 'estudiantes') {
      return Math.max(...data.map(b => b.totalEstudiantes));
    } else {
      return Math.max(...data.map(b => b.totalAhorro));
    }
  }

  // Helpers para obtener totales por tipo
  getTotalEstudiantesByTipo(data: BeneficioData[]): number {
    return data.reduce((sum, b) => sum + b.totalEstudiantes, 0);
  }

  getTotalAhorroByTipo(data: BeneficioData[]): number {
    return data.reduce((sum, b) => sum + b.totalAhorro, 0);
  }

  getBarWidth(value: number, maxValue: number): number {
    return maxValue > 0 ? (value / maxValue) * 100 : 0;
  }

  formatCurrency(value: number): string {
    return `Bs. ${value.toLocaleString('es-BO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }

  formatNumber(value: number): string {
    return value.toLocaleString('es-BO');
  }

  // Métodos de exportación a Excel
  exportarBeneficiosEstudiantes(): void {
    const data = this.beneficiosData.map(b => ({
      'Tipo de Beneficio': b.nombre,
      'Total Estudiantes': b.totalEstudiantes,
      'Porcentaje': `${((b.totalEstudiantes / this.totalEstudiantes) * 100).toFixed(2)}%`
    }));

    // Agregar fila de totales
    data.push({
      'Tipo de Beneficio': 'TOTAL',
      'Total Estudiantes': this.totalEstudiantes,
      'Porcentaje': '100.00%'
    });

    this.exportToExcel(data, `Estudiantes_por_Beneficio_${this.getGestionNombre()}`);
  }

  exportarBeneficiosAhorro(): void {
    const data = this.beneficiosData.map(b => ({
      'Tipo de Beneficio': b.nombre,
      'Total Ahorro (Bs.)': b.totalAhorro,
      'Porcentaje': `${((b.totalAhorro / this.totalAhorro) * 100).toFixed(2)}%`
    }));

    // Agregar fila de totales
    data.push({
      'Tipo de Beneficio': 'TOTAL',
      'Total Ahorro (Bs.)': this.totalAhorro,
      'Porcentaje': '100.00%'
    });

    this.exportToExcel(data, `Ahorro_por_Beneficio_${this.getGestionNombre()}`);
  }

  exportarCarrerasEstudiantes(): void {
    const data = this.carrerasData.map(c => ({
      'Carrera': c.nombre,
      'Total Estudiantes': c.totalEstudiantes,
      'Porcentaje': `${((c.totalEstudiantes / this.totalEstudiantes) * 100).toFixed(2)}%`
    }));

    // Agregar fila de totales
    data.push({
      'Carrera': 'TOTAL',
      'Total Estudiantes': this.totalEstudiantes,
      'Porcentaje': '100.00%'
    });

    this.exportToExcel(data, `Estudiantes_por_Carrera_${this.getGestionNombre()}`);
  }

  exportarCarrerasAhorro(): void {
    const data = this.carrerasData.map(c => ({
      'Carrera': c.nombre,
      'Total Ahorro (Bs.)': c.totalAhorro,
      'Porcentaje': `${((c.totalAhorro / this.totalAhorro) * 100).toFixed(2)}%`
    }));

    // Agregar fila de totales
    data.push({
      'Carrera': 'TOTAL',
      'Total Ahorro (Bs.)': this.totalAhorro,
      'Porcentaje': '100.00%'
    });

    this.exportToExcel(data, `Ahorro_por_Carrera_${this.getGestionNombre()}`);
  }

  exportarEvolucion(): void {
    if (this.evolucionData.length === 0) {
      console.warn('No hay datos de evolución para exportar');
      return;
    }

    // Obtener todos los beneficios únicos
    const beneficios = this.beneficiosData.map(b => b.nombre);

    // Crear datos para Excel con estructura: Gestión | Beneficio 1 | Beneficio 2 | ... | Total
    const data = this.evolucionData.map(row => {
      const excelRow: any = {
        'Gestión': row.gestion
      };

      let totalGestion = 0;

      // Agregar columna por cada beneficio
      beneficios.forEach(beneficio => {
        const valor = row[beneficio] as number || 0;
        excelRow[beneficio] = valor;
        totalGestion += valor;
      });

      // Agregar total de la gestión
      excelRow['Total'] = totalGestion;

      return excelRow;
    });

    // Calcular totales por beneficio
    const totalesRow: any = {
      'Gestión': 'TOTAL'
    };

    let granTotal = 0;

    beneficios.forEach(beneficio => {
      const totalBeneficio = this.evolucionData.reduce((sum, row) => {
        return sum + (row[beneficio] as number || 0);
      }, 0);
      totalesRow[beneficio] = totalBeneficio;
      granTotal += totalBeneficio;
    });

    totalesRow['Total'] = granTotal;

    // Agregar fila de totales
    data.push(totalesRow);

    this.exportToExcel(data, `Evolucion_Beneficios`);
  }

  private exportToExcel(data: any[], filename: string): void {
    // Crear workbook y worksheet
    const ws: XLSX.WorkSheet = XLSX.utils.json_to_sheet(data);
    const wb: XLSX.WorkBook = XLSX.utils.book_new();
    
    // Ajustar ancho de columnas
    const maxWidth = 50;
    const colWidths = Object.keys(data[0] || {}).map(key => ({
      wch: Math.min(
        Math.max(
          key.length,
          ...data.map(row => String(row[key] || '').length)
        ),
        maxWidth
      )
    }));
    ws['!cols'] = colWidths;

    // Agregar worksheet al workbook
    XLSX.utils.book_append_sheet(wb, ws, 'Datos');
    
    // Generar fecha para el nombre del archivo
    const fecha = new Date().toISOString().split('T')[0];
    
    // Descargar archivo
    XLSX.writeFile(wb, `${filename}_${fecha}.xlsx`);
  }

  private getGestionNombre(): string {
    const gestion = this.gestiones.find(g => g.id === this.gestionSeleccionada);
    return gestion ? gestion.gestion.replace(/\//g, '-') : 'Sin_Gestion';
  }
}
