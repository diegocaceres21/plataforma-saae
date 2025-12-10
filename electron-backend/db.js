const { Pool } = require('pg');
const pool = new Pool({
  user: 'postgres',
  host: 'localhost',
  database: 'saae',
  password: '12345678',
  port: '5432',
  ssl: 'false' === 'true' ? true : false,
  channelBinding: 'require',
});

module.exports = pool;