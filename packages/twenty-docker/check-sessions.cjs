const { Client } = require('pg');

async function run() {
  const c = new Client({ connectionString: process.env.PG_DATABASE_URL || 'postgres://postgres:postgres@db:5432/default' });
  await c.connect();

  const tables = await c.query(`
    SELECT table_name FROM information_schema.tables WHERE table_schema = 'core' AND (table_name ILIKE '%session%' OR table_name ILIKE '%token%');
  `);
  console.log('Session/token tables:', tables.rows);

  await c.end();
}

run().catch(console.error);

