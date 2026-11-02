const { Client } = require('pg');

async function run() {
  const c = new Client({
    connectionString: process.env.PG_DATABASE_URL || 'postgres://postgres:postgres@db:5432/default',
  });
  await c.connect();

  const wsId = '32c2a902-9983-4e13-b6f6-bc96609f8238';

  const res = await c.query(`
    SELECT name, type, options, "defaultValue", settings
    FROM core."fieldMetadata"
    WHERE "workspaceId" = $1 AND type = 'SELECT'
    LIMIT 4
  `, [wsId]);
  console.log('Sample SELECT fields in metadata:');
  res.rows.forEach(r => console.log(r));

  await c.end();
}

run().catch(console.error);

