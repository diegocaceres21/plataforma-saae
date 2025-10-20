// Models for DB tables
module.exports = {
  tarifario: {
    table: 'tarifario',
    columns: ['id', 'tarifario', 'valor_credito', 'visible', 'created_at', 'updated_at']
  },
  departamento: {
    table: 'departamento',
    columns: ['id', 'departamento', 'created_at', 'updated_at']
  },
  carrera: {
    table: 'carrera',
    columns: ['id', 'carrera', 'id_tarifario', 'id_departamento', 'incluye_tecnologico', 'visible', 'created_at', 'updated_at']
  },

  gestion: {
    table: 'gestion',
    columns: ['id', 'gestion', 'anio', 'tipo', 'activo', 'visible', 'created_at', 'updated_at']
  },
  apoyo_familiar: {
    table: 'apoyo_familiar',
    columns: ['id', 'orden', 'porcentaje', 'created_at', 'updated_at']
  },
  solicitud: {
    table: 'solicitud',
    columns: ['id', 'fecha', 'id_gestion', 'estado', 'cantidad_estudiantes', 'comentarios', 'visible', 'created_at', 'updated_at']
  },
  registro_estudiante: {
    table: 'registro_estudiante',
    columns: [
      'id', 'id_solicitud', 'id_estudiante_siaan', 'id_gestion', 'ci_estudiante', 'nombre_estudiante', 
      'carrera', 'valor_credito', 'total_creditos', 'credito_tecnologico', 'porcentaje_descuento', 
      'monto_primer_pago', 'plan_primer_pago', 'referencia_primer_pago', 'total_semestre', 'registrado', 'comentarios',
      'visible', 'created_at', 'updated_at', 'id_beneficio', 'id_carrera'
    ]
  },
  beneficio: {
    table: 'beneficio',
    columns: ['id', 'nombre', 'tipo', 'porcentaje', 'limite_creditos']
  }
};
