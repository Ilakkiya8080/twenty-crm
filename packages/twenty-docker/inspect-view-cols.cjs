const { Client } = require('pg');

async function run() {
  const c = new Client({ connectionString: process.env.PG_DATABASE_URL || 'postgres://postgres:postgres@db:5432/default' });
  await c.connect();
  const res = await c.query(`
    SELECT column_name, data_type
    FROM information_schema.columns
    WHERE table_schema = 'core' AND table_name = 'view';
  `);
  console.table(res.rows);
  await c.end();
}

run().catch(console.error);

