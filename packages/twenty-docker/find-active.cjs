const { Client } = require('pg');

async function main() {
  const c = new Client({
    connectionString: process.env.PG_DATABASE_URL || 'postgres://twenty:twenty@db:5432/default',
  });
  await c.connect();

  const vRes = await c.query('SELECT * FROM core."view" WHERE id = $1', ['786ce9f7-8787-4c3b-bfd0-776c5692bdd1']);
  console.log('View from screenshot:', vRes.rows[0]);

  const allActiveWs = await c.query('SELECT id, "displayName", "databaseSchema", "createdAt", "updatedAt" FROM core.workspace WHERE "deletedAt" IS NULL ORDER BY "createdAt" DESC');
  console.log('Active Workspaces:');
  allActiveWs.rows.forEach(w => console.log(`  ID: ${w.id} | Name: ${w.displayName} | Schema: ${w.databaseSchema} | Created: ${w.createdAt}`));

  await c.end();
}

main().catch(console.error);
