const { Client } = require('pg');

async function run() {
  const client = new Client({ connectionString: process.env.PG_DATABASE_URL || 'postgres://postgres:postgres@db:5432/default' });
  await client.connect();

  const res = await client.query(`
    SELECT name, type, "defaultValue", "isNullable"
    FROM core."fieldMetadata"
    WHERE type = 'UUID' AND "defaultValue" IS NOT NULL
    LIMIT 5;
  `);
  console.log('UUID field defaults:');
  console.table(res.rows);

  const res2 = await client.query(`
    SELECT name, type, "defaultValue", "isNullable"
    FROM core."fieldMetadata"
    WHERE name = 'id'
    LIMIT 5;
  `);
  console.log('id field defaults:');
  console.table(res2.rows);

  await client.end();
}

run().catch(console.error);

