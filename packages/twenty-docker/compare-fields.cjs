const { Client } = require('pg');

async function run() {
  const c = new Client({ connectionString: process.env.PG_DATABASE_URL || 'postgres://postgres:postgres@db:5432/default' });
  await c.connect();

  const res = await c.query(`
    SELECT *
    FROM core."fieldMetadata"
    WHERE name IN ('leadId', 'propertyId')
    ORDER BY name;
  `);
  console.log('Comparison of leadId vs propertyId:');
  console.log(res.rows);

  await c.end();
}

run().catch(console.error);

