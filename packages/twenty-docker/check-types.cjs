const { Client } = require('pg');

async function checkFieldTypes() {
  const c = new Client({
    connectionString: process.env.PG_DATABASE_URL || 'postgres://postgres:postgres@db:5432/default',
  });
  await c.connect();

  const types = await c.query(`SELECT DISTINCT type FROM core."fieldMetadata" ORDER BY type`);
  console.log('All Field Metadata Types in Twenty:', types.rows.map(r => r.type));

  await c.end();
}

checkFieldTypes().catch(console.error);

