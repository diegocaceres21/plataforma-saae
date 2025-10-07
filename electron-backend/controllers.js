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
  const query = 'SELECT id, username, nombre, password_hash, rol, activo FROM usuario WHERE username = $1 LIMIT 1';
  const result = await pool.query(query, [username]);
  
  if (result.rows.length === 0) {
    throw new Error('Usuario o contraseña inválidos');
  }
  const user = result.rows[0];
  if (!user.activo) {
    throw new Error('Usuario inactivo');
  }
  const ok = await bcrypt.compare(password, user.password_hash);
  if (!ok) {
    throw new Error('Usuario o contraseña inválidos');
  }
  const payload = { sub: user.id, username: user.username, nombre: user.nombre, rol: user.rol };
  const token = jwt.sign(payload, JWT_SECRET, { expiresIn: `${JWT_EXP_HOURS}h` });
  return { token, user: { id: user.id, username: user.username, nombre: user.nombre, rol: user.rol } };
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

// === Funciones de Gestión de Usuarios ===

/**
 * Obtiene todos los usuarios
 */
async function getAllUsers() {
  try {
    const result = await pool.query(
      'SELECT id, username, nombre, rol, activo, created_at, updated_at FROM usuario ORDER BY created_at DESC'
    );
    return { users: result.rows };
  } catch (error) {
    throw new Error(`Error al obtener usuarios: ${error.message}`);
  }
}

/**
 * Obtiene un usuario por ID
 */
async function getUserById(id) {
  try {
    const result = await pool.query(
      'SELECT id, username, nombre, rol, activo, created_at, updated_at FROM usuario WHERE id = $1',
      [id]
    );
    
    if (result.rows.length === 0) {
      throw new Error('Usuario no encontrado');
    }
    
    return { user: result.rows[0] };
  } catch (error) {
    throw new Error(`Error al obtener usuario: ${error.message}`);
  }
}

/**
 * Crea un nuevo usuario
 */
async function createUser(data) {
  const { username, nombre, password, rol } = data || {};
  
  if (!username || !nombre || !password) {
    throw new Error('username, nombre y password son requeridos');
  }
  
  if (username.length < 3) {
    throw new Error('El username debe tener al menos 3 caracteres');
  }
  
  if (password.length < 6) {
    throw new Error('La contraseña debe tener al menos 6 caracteres');
  }
  
  const role = rol && rol.trim() ? rol.trim() : 'usuario';
  
  try {
    // Verificar que el username no exista
    const exists = await pool.query('SELECT 1 FROM usuario WHERE username = $1', [username]);
    if (exists.rows.length > 0) {
      throw new Error('El nombre de usuario ya existe');
    }
    
    const hash = await bcrypt.hash(password, 10);
    const result = await pool.query(
      'INSERT INTO usuario (username, nombre, password_hash, rol) VALUES ($1, $2, $3, $4) RETURNING id, username, nombre, rol, activo, created_at, updated_at',
      [username, nombre, hash, role]
    );
    
    return { user: result.rows[0] };
  } catch (error) {
    throw new Error(`Error al crear usuario: ${error.message}`);
  }
}

/**
 * Actualiza un usuario
 */
async function updateUser(id, data) {
  const { username, nombre, rol, activo } = data || {};
  
  if (!username && !nombre && !rol && activo === undefined) {
    throw new Error('Al menos un campo debe ser proporcionado para actualizar');
  }
  
  try {
    // Verificar que el usuario existe
    const userExists = await pool.query('SELECT 1 FROM usuario WHERE id = $1', [id]);
    if (userExists.rows.length === 0) {
      throw new Error('Usuario no encontrado');
    }
    
    // Si se está actualizando el username, verificar que no exista
    if (username) {
      const usernameExists = await pool.query('SELECT 1 FROM usuario WHERE username = $1 AND id != $2', [username, id]);
      if (usernameExists.rows.length > 0) {
        throw new Error('El nombre de usuario ya existe');
      }
    }
    
    const updates = [];
    const values = [];
    let paramCount = 1;
    
    if (username) {
      updates.push(`username = $${paramCount++}`);
      values.push(username);
    }
    
    if (nombre) {
      updates.push(`nombre = $${paramCount++}`);
      values.push(nombre);
    }
    
    if (rol) {
      updates.push(`rol = $${paramCount++}`);
      values.push(rol);
    }
    
    if (activo !== undefined) {
      updates.push(`activo = $${paramCount++}`);
      values.push(activo);
    }
    
    updates.push(`updated_at = $${paramCount++}`);
    values.push(new Date());
    
    values.push(id); // Para el WHERE
    
    const query = `UPDATE usuario SET ${updates.join(', ')} WHERE id = $${paramCount} RETURNING id, username, nombre, rol, activo, created_at, updated_at`;
    const result = await pool.query(query, values);
    
    return { user: result.rows[0] };
  } catch (error) {
    throw new Error(`Error al actualizar usuario: ${error.message}`);
  }
}

/**
 * Cambia la contraseña de un usuario
 */
async function changeUserPassword(id, newPassword) {
  if (!newPassword) {
    throw new Error('La nueva contraseña es requerida');
  }
  
  if (newPassword.length < 6) {
    throw new Error('La contraseña debe tener al menos 6 caracteres');
  }
  
  try {
    // Verificar que el usuario existe
    const userExists = await pool.query('SELECT 1 FROM usuario WHERE id = $1', [id]);
    if (userExists.rows.length === 0) {
      throw new Error('Usuario no encontrado');
    }
    
    const hash = await bcrypt.hash(newPassword, 10);
    await pool.query(
      'UPDATE usuario SET password_hash = $1, updated_at = $2 WHERE id = $3',
      [hash, new Date(), id]
    );
    
    return { success: true };
  } catch (error) {
    throw new Error(`Error al cambiar contraseña: ${error.message}`);
  }
}

/**
 * Elimina un usuario
 */
async function deleteUser(id) {
  try {
    // Verificar que el usuario existe
    const userExists = await pool.query('SELECT 1 FROM usuario WHERE id = $1', [id]);
    if (userExists.rows.length === 0) {
      throw new Error('Usuario no encontrado');
    }
    
    await pool.query('DELETE FROM usuario WHERE id = $1', [id]);
    return { success: true };
  } catch (error) {
    throw new Error(`Error al eliminar usuario: ${error.message}`);
  }
}

module.exports.getAllUsers = getAllUsers;
module.exports.getUserById = getUserById;
module.exports.createUser = createUser;
module.exports.updateUser = updateUser;
module.exports.changeUserPassword = changeUserPassword;
module.exports.deleteUser = deleteUser;
