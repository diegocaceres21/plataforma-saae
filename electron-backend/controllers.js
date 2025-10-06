const pool = require('./db');
const models = require('./models');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

// Clave JWT: usar variable de entorno JWT_SECRET en producción
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-me';
const JWT_EXP_HOURS = 8; // expiración estándar

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
/**
 * Autentica usuario verificando username y password.
 * Devuelve { token, user: { id, username, rol } }
 */
async function authenticateUser(username, password) {
  if (!username || !password) {
    throw new Error('Credenciales incompletas');
  }
  const query = 'SELECT id, username, password_hash, rol, activo FROM usuario WHERE username = $1 LIMIT 1';
  const result = await pool.query(query, [username]);
  
  if (result.rows.length === 0) {
    throw new Error('Usuario o contraseña inválidos');
  }
  const user = result.rows[0];
  if (!user.activo) {
    throw new Error('Usuario inactivo');
  }
  const ok = await bcrypt.compare(password, user.password_hash);
  console.log(ok);
  if (!ok) {
    throw new Error('Usuario o contraseña inválidos');
  }
  const payload = { sub: user.id, username: user.username, rol: user.rol };
  const token = jwt.sign(payload, JWT_SECRET, { expiresIn: `${JWT_EXP_HOURS}h` });
  return { token, user: { id: user.id, username: user.username, rol: user.rol } };
}

/**
 * Verifica un token JWT y devuelve payload básico.
 */
async function verifyToken(token) {
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    return { valid: true, payload: decoded };
  } catch (err) {
    return { valid: false, error: err.message };
  }
}

module.exports.authenticateUser = authenticateUser;
module.exports.verifyToken = verifyToken;
/**
 * Registra un nuevo usuario.
 * @param {{username:string,password:string,rol?:string}} data
 * Reglas:
 *  - username único (min 3, max 60)
 *  - password min 6 chars
 *  - rol opcional (default 'usuario')
 */
async function registerUser(data) {
  const { username, nombre, password, rol } = data || {};
  if (!username || !nombre || !password) throw new Error('username, nombre y password requeridos');
  if (username.length < 3) throw new Error('username demasiado corto');
  if (password.length < 6) throw new Error('password demasiado corto');
  const role = rol && rol.trim() ? rol.trim() : 'usuario';

  // Verificar duplicado
  const exists = await pool.query('SELECT 1 FROM usuario WHERE username = $1', [username]);
  if (exists.rows.length > 0) throw new Error('username ya existe');

  const hash = await bcrypt.hash(password, 10);
  const insert = await pool.query(
    'INSERT INTO usuario (username, nombre, password_hash, rol) VALUES ($1,$2,$3,$4) RETURNING id, username, nombre, rol, created_at',
    [username, nombre, hash, role]
  );
  const user = insert.rows[0];
  return { user };
}

module.exports.registerUser = registerUser;
