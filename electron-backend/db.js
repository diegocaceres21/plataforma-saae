const { Pool } = require('pg');
const path = require('path');
const dotenv = require('dotenv');
const { app } = require('electron');

// Load .env file from resources path when packaged
if (app.isPackaged) {
  dotenv.config({ path: path.join(process.resourcesPath, '.env') });
} else {
  dotenv.config();
}

const pool = new Pool({
  user: process.env.DB_USER || 'postgres',
  host: process.env.DB_HOST || 'localhost',
  database: process.env.DB_NAME || 'saae',
  password: process.env.DB_PASSWORD || '12345678',
  port: process.env.DB_PORT || '5432',
  ssl: process.env.DB_SSL === 'true',
  channelBinding: 'require',
});

// Add connection error handling
pool.on('error', (err) => {
  console.error('Unexpected database error:', err);
});

module.exports = pool;