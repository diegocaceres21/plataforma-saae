const pool = require('./db');
const models = require('./models');

function getAll(table) {
  return new Promise((resolve, reject) => {
    let query = `SELECT * FROM ${table}`;
    
    // Ordenamiento específico para diferentes tablas
    switch (table) {
      case 'carrera':
        query += ' ORDER BY carrera ASC';
        break;
      case 'departamento':
        query += ' ORDER BY departamento ASC';
        break;
      case 'tarifario':
        query += ' ORDER BY tarifario ASC';
        break;
      case 'gestion':
        query += ' ORDER BY anio DESC, tipo ASC, gestion DESC';
        break;
      case 'apoyo_familiar':
        query += ' ORDER BY orden ASC';
        break;
      default:
        // Para otras tablas, mantener el orden por defecto
        break;
    }
    
    pool.query(query, [], (err, result) => {
      if (err) reject(err);
      else resolve(result.rows);
    });
  });
}

function getAllVisible(table) {
  return new Promise((resolve, reject) => {
    const model = models[Object.keys(models).find(key => models[key].table === table)];
    
    let query = `SELECT * FROM ${table}`;
    
    // Add visible filter only for tables that have visible column
    if (model && model.columns.includes('visible')) {
      query += ' WHERE visible = true';
    }
    
    // Ordenamiento específico para diferentes tablas
    switch (table) {
      case 'carrera':
        query += ' ORDER BY carrera ASC';
        break;
      case 'departamento':
        query += ' ORDER BY departamento ASC';
        break;
      case 'tarifario':
        query += ' ORDER BY tarifario ASC';
        break;
      case 'gestion':
        query += ' ORDER BY anio DESC, tipo ASC, gestion DESC';
        break;
      case 'apoyo_familiar':
        query += ' ORDER BY orden ASC';
        break;
      default:
        // Para otras tablas, mantener el orden por defecto
        break;
    }
    
    pool.query(query, [], (err, result) => {
      if (err) reject(err);
      else resolve(result.rows);
    });
  });
}

function getById(table, id) {
  return new Promise((resolve, reject) => {
    pool.query(`SELECT * FROM ${table} WHERE id = $1`, [id], (err, result) => {
      if (err) reject(err);
      else resolve(result.rows[0]);
    });
  });
}

function create(table, data) {
  const cols = Object.keys(data);
  const vals = Object.values(data);
  const placeholders = cols.map((_, i) => `$${i + 1}`).join(',');
  return new Promise((resolve, reject) => {
    pool.query(`INSERT INTO ${table} (${cols.join(',')}) VALUES (${placeholders}) RETURNING *`, vals, (err, result) => {
      if (err) reject(err);
      else resolve(result.rows[0]);
    });
  });
}

function update(table, id, data) {
  const cols = Object.keys(data);
  const vals = Object.values(data);
  const setStr = cols.map((col, index) => `${col} = $${index + 1}`).join(', ');
  return new Promise((resolve, reject) => {
    pool.query(`UPDATE ${table} SET ${setStr} WHERE id = $${vals.length + 1}`, [...vals, id], (err, result) => {
      if (err) reject(err);
      else resolve({ id, ...data });
    });
  });
}

function remove(table, id) {
  return new Promise((resolve, reject) => {
    pool.query(`DELETE FROM ${table} WHERE id = $1`, [id], (err, result) => {
      if (err) reject(err);
      else resolve({ id });
    });
  });
}

function createMultiple(table, dataArray) {
  return new Promise((resolve, reject) => {
    if (!dataArray || dataArray.length === 0) {
      return resolve([]);
    }

    // Get column names from the first record
    const cols = Object.keys(dataArray[0]);
    const colsStr = cols.join(',');

    // Create values string for multiple records
    const valueGroups = dataArray.map((_, index) => {
      const startIndex = index * cols.length + 1;
      const placeholders = cols.map((_, colIndex) => `$${startIndex + colIndex}`).join(',');
      return `(${placeholders})`;
    }).join(',');

    // Flatten all values
    const allValues = dataArray.flatMap(record => Object.values(record));

    const query = `INSERT INTO ${table} (${colsStr}) VALUES ${valueGroups} RETURNING *`;

    pool.query(query, allValues, (err, result) => {
      if (err) {
        console.error('Error in createMultiple:', err);
        reject(err);
      } else {
        resolve(result.rows);
      }
    });
  });
}

function getBySolicitud(id_solicitud) {
  return new Promise((resolve, reject) => {
    pool.query(`SELECT * FROM registro_estudiante WHERE id_solicitud = $1`, [id_solicitud], (err, result) => {
      if (err) reject(err);
      else resolve(result.rows);
    });
  });
}

module.exports = { getAll, getAllVisible, getById, create, update, remove, createMultiple, getBySolicitud };
