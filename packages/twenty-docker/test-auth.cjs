const { Client } = require('pg');

async function run() {
  const c = new Client({ connectionString: process.env.PG_DATABASE_URL || 'postgres://postgres:postgres@db:5432/default' });
  await c.connect();

  // Get user session token or workspaceMember
  const tokenRes = await c.query(`
    SELECT * FROM core."appToken" LIMIT 1;
  `).catch(() => ({ rows: [] }));
  console.log('AppToken:', tokenRes.rows);

  const userRes = await c.query(`
    SELECT id, email FROM core."user" LIMIT 1;
  `);
  console.log('User:', userRes.rows);

  await c.end();
}

run().catch(console.error);

