const { Client } = require('pg');

async function run() {
  const c = new Client({ connectionString: process.env.PG_DATABASE_URL || 'postgres://postgres:postgres@db:5432/default' });
  await c.connect();

  const view = await c.query(`
    SELECT * FROM core."view" WHERE id = '3ba023cc-ed9c-4ebe-888c-561424e7e3eb';
  `);
  console.log('View:');
  console.log(view.rows[0]);

  await c.end();
}

run().catch(console.error);

