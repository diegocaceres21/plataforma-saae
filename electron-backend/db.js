const { Pool } = require('pg');
const pool = new Pool({
  user: 'neondb_owner',
  host: 'ep-cool-flower-acv4k7vc-pooler.sa-east-1.aws.neon.tech',
  database: 'saae',
  password: 'npg_Yv86bOQEuNgd',
  port: 5432,
  ssl: true,
  channelBinding: 'require',
});

/*
PGHOST='ep-cool-flower-acv4k7vc-pooler.sa-east-1.aws.neon.tech'
PGDATABASE='saae'
PGUSER='neondb_owner'
PGPASSWORD='npg_Yv86bOQEuNgd'
PGSSLMODE='require'
PGCHANNELBINDING='require'*/

module.exports = pool;