const { Client } = require('pg');

async function run() {
  const c = new Client({
    connectionString: process.env.PG_DATABASE_URL || 'postgres://postgres:postgres@db:5432/default',
  });
  await c.connect();

  const r = await c.query(`
    SELECT name, type, writability, "isUIEditable", "isUIReadOnly", "isNullable"
    FROM core."fieldMetadata"
    WHERE "workspaceId" = '32c2a902-9983-4e13-b6f6-bc96609f8238'
    LIMIT 10
  `);
  console.log('Sample fields:', r.rows);

  await c.end();
}

run().catch(console.error);

