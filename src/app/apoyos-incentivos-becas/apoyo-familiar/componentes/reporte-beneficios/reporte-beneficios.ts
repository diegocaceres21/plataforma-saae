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
  Tooltip,
  Legend
} from 'chart.js';
import * as XLSX from 'xlsx';

// Registrar componentes necesarios de Chart.js
Chart.register(
  CategoryScale,
  LinearScale,
  BarElement,
  BarController,
  Tooltip,
  Legend
);

interface GestionOption {
  id: string;
  nombre: string;
}

interface BeneficioData {
  nombre: string;
  totalEstudiantes: number;
  totalAhorro: number;
  color: string;
}

interface CarreraData {
  nombre: string;
  totalEstudiantes: number;
  totalAhorro: number;
  color: string;
}

@Component({
  selector: 'app-reporte-beneficios',
  standalone: true,
  imports: [CommonModule, FormsModule, BaseChartDirective],
  templateUrl: './reporte-beneficios.html',
  styleUrl: './reporte-beneficios.scss'
})
export class ReporteBeneficios implements OnInit {
  // Filtros
  gestionSeleccionada: string = '';
  gestiones: GestionOption[] = [];

  // Métricas principales
  totalEstudiantes: number = 0;
  totalAhorro: number = 0;

  // Datos para gráficos
  beneficiosData: BeneficioData[] = [];
  carrerasData: CarreraData[] = [];

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

  ngOnInit(): void {
    this.initializeMockData();
    this.loadData();
  }

  private loadData(): void {
    this.isLoading = true;

    // Simular carga de datos
    setTimeout(() => {
      this.calculateMetrics();
      this.updateChartData();
      this.isLoading = false;
    }, 500);
  }

  private updateChartData(): void {
    // Actualizar datos del gráfico de estudiantes
    this.barChartDataEstudiantes = {
      labels: this.carrerasData.map(c => c.nombre),
      datasets: [{
        label: 'Estudiantes',
        data: this.carrerasData.map(c => c.totalEstudiantes),
        backgroundColor: '#003B71',//this.carrerasData.map(c => c.color + 'dd'),
        //borderColor: this.carrerasData.map(c => c.color),
        borderWidth: 2,
        borderRadius: 8,
        borderSkipped: false,
      }]
    };

    // Actualizar datos del gráfico de ahorro
    this.barChartDataAhorro = {
      labels: this.carrerasData.map(c => c.nombre),
      datasets: [{
        label: 'Ahorro',
        data: this.carrerasData.map(c => c.totalAhorro),
        backgroundColor: "#003B71",//this.carrerasData.map(c => c.color + 'dd'),
        //borderColor: this.carrerasData.map(c => c.color),
        borderWidth: 2,
        borderRadius: 7,
        borderSkipped: false,
      }]
    };
  }

  private initializeMockData(): void {
    // Mock data de gestiones
    this.gestiones = [
      { id: '1', nombre: '2024-I' },
      { id: '2', nombre: '2024-II' },
      { id: '3', nombre: '2023-II' },
      { id: '4', nombre: '2023-I' }
    ];

    // Seleccionar la primera gestión por defecto
    this.gestionSeleccionada = this.gestiones[0]?.id || '';

    // Mock data de beneficios - Paleta UCB
    this.beneficiosData = [
      {
        nombre: 'Apoyo Familiar',
        totalEstudiantes: 145,
        totalAhorro: 285670.50,
        color: '#003B71' // Azul UCB primario
      },
      {
        nombre: 'Excelencia Académica',
        totalEstudiantes: 78,
        totalAhorro: 156340.25,
        color: '#FDB913' // Amarillo UCB
      },
      {
        nombre: 'Deportista Destacado',
        totalEstudiantes: 32,
        totalAhorro: 64280.00,
        color: '#005A9C' // Azul medio
      },
      {
        nombre: 'Mérito Cultural',
        totalEstudiantes: 25,
        totalAhorro: 48950.75,
        color: '#F7931E' // Naranja dorado
      },
      {
        nombre: 'Beca Completa',
        totalEstudiantes: 15,
        totalAhorro: 98450.00,
        color: '#00518F' // Azul intermedio
      }
    ];

    // Mock data de carreras (20 carreras) - Paleta UCB
    this.carrerasData = [
      {
        nombre: 'Ingeniería de Sistemas',
        totalEstudiantes: 68,
        totalAhorro: 142850.00,
        color: '#003B71'
      },
      {
        nombre: 'Administración de Empresas',
        totalEstudiantes: 52,
        totalAhorro: 108640.50,
        color: '#FDB913'
      },
      {
        nombre: 'Contaduría Pública',
        totalEstudiantes: 45,
        totalAhorro: 94275.75,
        color: '#005A9C'
      },
      {
        nombre: 'Derecho',
        totalEstudiantes: 38,
        totalAhorro: 79590.25,
        color: '#F7931E'
      },
      {
        nombre: 'Psicología',
        totalEstudiantes: 31,
        totalAhorro: 64925.00,
        color: '#00518F'
      },
      {
        nombre: 'Ingeniería Civil',
        totalEstudiantes: 24,
        totalAhorro: 50280.50,
        color: '#FCBF49'
      },
      {
        nombre: 'Arquitectura',
        totalEstudiantes: 19,
        totalAhorro: 39785.25,
        color: '#004A7C'
      },
      {
        nombre: 'Medicina',
        totalEstudiantes: 32,
        totalAhorro: 67140.00,
        color: '#FFA500'
      },
      {
        nombre: 'Comunicación Social',
        totalEstudiantes: 28,
        totalAhorro: 58760.00,
        color: '#0066A1'
      },
      {
        nombre: 'Turismo y Hotelería',
        totalEstudiantes: 16,
        totalAhorro: 33560.25,
        color: '#FFD700'
      },
      {
        nombre: 'Ingeniería Industrial',
        totalEstudiantes: 41,
        totalAhorro: 85910.50,
        color: '#003B71'
      },
      {
        nombre: 'Marketing',
        totalEstudiantes: 35,
        totalAhorro: 73325.00,
        color: '#FDB913'
      },
      {
        nombre: 'Ingeniería Comercial',
        totalEstudiantes: 29,
        totalAhorro: 60745.75,
        color: '#005A9C'
      },
      {
        nombre: 'Diseño Gráfico',
        totalEstudiantes: 22,
        totalAhorro: 46090.00,
        color: '#F7931E'
      },
      {
        nombre: 'Odontología',
        totalEstudiantes: 18,
        totalAhorro: 37710.50,
        color: '#00518F'
      },
      {
        nombre: 'Enfermería',
        totalEstudiantes: 25,
        totalAhorro: 52375.00,
        color: '#FCBF49'
      },
      {
        nombre: 'Ingeniería Financiera',
        totalEstudiantes: 33,
        totalAhorro: 69165.75,
        color: '#004A7C'
      },
      {
        nombre: 'Ingeniería Mecatrónica',
        totalEstudiantes: 21,
        totalAhorro: 44020.25,
        color: '#FFA500'
      },
      {
        nombre: 'Trabajo Social',
        totalEstudiantes: 14,
        totalAhorro: 29330.00,
        color: '#0066A1'
      },
      {
        nombre: 'Bioquímica y Farmacia',
        totalEstudiantes: 17,
        totalAhorro: 35615.50,
        color: '#FFD700'
      }
    ];
  }

  private calculateMetrics(): void {
    // Calcular totales
    this.totalEstudiantes = this.beneficiosData.reduce((sum, b) => sum + b.totalEstudiantes, 0);
    this.totalAhorro = this.beneficiosData.reduce((sum, b) => sum + b.totalAhorro, 0);
  }

  onGestionChange(): void {
    // Recargar datos cuando cambia la gestión
    this.loadData();
  }

  // Helpers para gráficos de barras horizontales
  getMaxValue(type: 'estudiantes' | 'ahorro'): number {
    if (type === 'estudiantes') {
      return Math.max(...this.beneficiosData.map(b => b.totalEstudiantes));
    } else {
      return Math.max(...this.beneficiosData.map(b => b.totalAhorro));
    }
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
    return gestion ? gestion.nombre.replace(/\//g, '-') : 'Sin_Gestion';
  }
}
