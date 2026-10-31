const { Client } = require('pg');

async function run() {
  const c = new Client({ connectionString: process.env.PG_DATABASE_URL || 'postgres://postgres:postgres@db:5432/default' });
  await c.connect();

  const personGroups = await c.query(`
    SELECT * FROM core."viewFieldGroup"
    WHERE "viewId" = '7d9fac2a-695c-4899-bcce-d565e50ee477';
  `);
  console.log('Person viewFieldGroups:');
  console.table(personGroups.rows);

  await c.end();
}

run().catch(console.error);

