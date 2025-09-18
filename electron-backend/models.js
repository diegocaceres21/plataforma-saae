// Models for DB tables
module.exports = {
  tarifario: {
    table: 'tarifario',
    columns: ['id', 'tarifario', 'valor_credito', 'created_at', 'updated_at']
  },
  departamento: {
    table: 'departamento',
    columns: ['id', 'departamento']
  },
  carrera: {
    table: 'carrera',
    columns: ['id', 'carrera', 'id_departamento', 'id_tarifario', 'incluye_tecnologico', 'created_at']
  },

  gestion: {
    table: 'gestion',
    columns: ['id', 'gestion', 'anio', 'orden', 'activo']
  },
  apoyo_familiar: {
    table: 'apoyo_familiar',
    columns: ['id','orden', 'porcentaje']
  },
  solicitud: {
    table: 'solicitud',
    columns: ['id', 'fecha', 'id_gestion']
  },
  registro_estudiante: {
    table: 'registro_estudiante',
    columns: [
      'id', 'id_solicitud', 'id_estudiante_siaan',  'ci_estudiante', 'nombre_estudiante', 'carrera',
      'valor_credito', 'total_creditos', 'credito_tecnologico',
      'porcentaje_descuento', 'total_semestre', 'registrado'
    ]
  }
};
