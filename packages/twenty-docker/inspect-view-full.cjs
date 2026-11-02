const { Client } = require('pg');

async function inspectViewFull() {
  const c = new Client({
    connectionString: process.env.PG_DATABASE_URL || 'postgres://postgres:postgres@db:5432/default',
  });
  await c.connect();

  const r = await c.query(`SELECT * FROM core.view WHERE id = '3193249a-407b-45d2-9e62-82753ef22bb0'`);
  console.log('View details:', r.rows[0]);

  // Check if there are any other views for tasks
  const allViews = await c.query(`SELECT * FROM core.view WHERE "objectMetadataId" = (SELECT id FROM core."objectMetadata" WHERE "nameSingular" = 'task' AND "workspaceId" = '32c2a902-9983-4e13-b6f6-bc96609f8238')`);
  console.log('All task views:', allViews.rows);

  await c.end();
}

inspectViewFull().catch(console.error);

