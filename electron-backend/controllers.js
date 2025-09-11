const pool = require('./db');
const models = require('./models');

function getAll(table) {
  return new Promise((resolve, reject) => {
    pool.query(`SELECT * FROM ${table}`, [], (err, result) => {
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
  const setStr = cols.map(col => `${col} = $${vals.length + 1}`).join(', ');
  return new Promise((resolve, reject) => {
    pool.query(`UPDATE ${table} SET ${setStr} WHERE id = $1`, [...vals, id], (err, result) => {
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

module.exports = { getAll, getById, create, update, remove };
