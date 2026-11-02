const { Client } = require('pg');

async function run() {
  const c = new Client({ connectionString: process.env.PG_DATABASE_URL || 'postgres://postgres:postgres@db:5432/default' });
  await c.connect();

  const sessions = await c.query(`
    SELECT * FROM core."userSession" ORDER BY "createdAt" DESC LIMIT 5;
  `);
  console.log('User sessions:');
  console.table(sessions.rows.map(s => ({ id: s.id, userId: s.userId, workspaceId: s.workspaceId, expiresAt: s.expiresAt })));

  await c.end();
}

run().catch(console.error);

