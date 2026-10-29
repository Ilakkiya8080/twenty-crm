const { Client } = require('pg');

async function main() {
  const c = new Client({
    connectionString: process.env.PG_DATABASE_URL || 'postgres://twenty:twenty@db:5432/default',
  });
  await c.connect();

  const uws = await c.query(`
    SELECT uw."workspaceId", w."displayName", w."deletedAt", u.email, uw."createdAt"
    FROM core."userWorkspace" uw
    JOIN core."workspace" w ON uw."workspaceId" = w.id
    JOIN core."user" u ON uw."userId" = u.id
    ORDER BY uw."createdAt" DESC LIMIT 10
  `);
  console.log('Recent userWorkspaces:');
  uws.rows.forEach(r => console.log(r));

  await c.end();
}

main().catch(console.error);
