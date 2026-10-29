const { Client } = require('pg');

async function main() {
  const c = new Client({ connectionString: process.env.PG_DATABASE_URL || 'postgres://postgres:postgres@db:5432/default' });
  await c.connect();

  const ws = await c.query(`
    SELECT id, "displayName", "activationStatus", "databaseSchema"
    FROM core."workspace"
    WHERE "deletedAt" IS NULL
    ORDER BY "createdAt" DESC
  `);
  console.log(`Found ${ws.rows.length} workspaces:`);
  console.table(ws.rows);

  await c.end();
}

main().catch(console.error);
