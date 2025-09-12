// Models for DB tables
module.exports = {
  gestion: {
    table: 'gestion',
    columns: ['id', 'gestion', 'anio', 'orden', 'activo']
  },
  apoyo_familiar: {
    table: 'apoyo_familiar',
    columns: ['orden', 'porcentaje']
  },
  solicitud: {
    table: 'solicitud',
    columns: ['id', 'fecha', 'id_gestion']
  },
  registro_estudiante: {
    table: 'registro_estudiante',
    columns: [
      'id', 'id_solicitud', 'ci_estudiante', 'nombre_estudiante', 'carrera',
      'valor_credito', 'total_creditos', 'credito_tecnologico',
      'porcentaje_descuento', 'total_semestre', 'registrado'
    ]
  }
};
