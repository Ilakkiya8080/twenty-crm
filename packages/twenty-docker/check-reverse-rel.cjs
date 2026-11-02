const { Client } = require('pg');

async function run() {
  const c = new Client({ connectionString: process.env.PG_DATABASE_URL || 'postgres://postgres:postgres@db:5432/default' });
  await c.connect();

  const res = await c.query(`
    SELECT *
    FROM core."fieldMetadata"
    WHERE id = '91f81847-92d7-411c-8a3f-ec552d8b3e73';
  `);
  console.log('accountOwnerForCompanies:');
  console.log(res.rows[0]);

  await c.end();
}

run().catch(console.error);

