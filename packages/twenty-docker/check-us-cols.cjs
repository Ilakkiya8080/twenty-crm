const { Client } = require('pg');

async function run() {
  const c = new Client({ connectionString: process.env.PG_DATABASE_URL || 'postgres://postgres:postgres@db:5432/default' });
  await c.connect();

  const cols = await c.query(`
    SELECT column_name, data_type FROM information_schema.columns WHERE table_schema = 'core' AND table_name = 'userSession';
  `);
  console.table(cols.rows);

  const row = await c.query(`
    SELECT * FROM core."userSession" WHERE "workspaceId" = '32c2a902-9983-4e13-b6f6-bc96609f8238' LIMIT 1;
  `);
  console.log('Session row:', row.rows[0]);

  await c.end();
}

run().catch(console.error);

