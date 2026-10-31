const { Client } = require('pg');

async function run() {
  const c = new Client({ connectionString: process.env.PG_DATABASE_URL || 'postgres://postgres:postgres@db:5432/default' });
  await c.connect();

  const wsId = '32c2a902-9983-4e13-b6f6-bc96609f8238';

  const keys = await c.query(`
    SELECT * FROM core."apiKey" WHERE "workspaceId" = $1;
  `, [wsId]);
  console.log('Api keys:');
  console.table(keys.rows);

  await c.end();
}

run().catch(console.error);

