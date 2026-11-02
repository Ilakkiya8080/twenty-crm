const { Client } = require('pg');

async function testJsonb() {
  const c = new Client({
    connectionString: process.env.PG_DATABASE_URL || 'postgres://postgres:postgres@db:5432/default',
  });
  await c.connect();

  const r1 = await c.query(`SELECT "defaultValue" FROM core."fieldMetadata" WHERE name = 'stage' LIMIT 1`);
  console.log('Raw defaultValue for stage:', JSON.stringify(r1.rows[0].defaultValue));

  const r2 = await c.query(`SELECT "defaultValue" FROM core."fieldMetadata" WHERE name = 'leadSource' LIMIT 1`);
  console.log('Raw defaultValue for leadSource:', JSON.stringify(r2.rows[0]?.defaultValue));

  await c.end();
}

testJsonb().catch(console.error);

