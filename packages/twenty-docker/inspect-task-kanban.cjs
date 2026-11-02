const { Client } = require('pg');

async function inspectTaskKanban() {
  const c = new Client({
    connectionString: process.env.PG_DATABASE_URL || 'postgres://postgres:postgres@db:5432/default',
  });
  await c.connect();

  const wsId = '32c2a902-9983-4e13-b6f6-bc96609f8238';

  const vgs = await c.query(`
    SELECT vg.*, v.name as "viewName"
    FROM core."viewGroup" vg
    JOIN core.view v ON v.id = vg."viewId"
    WHERE v."workspaceId" = $1 AND v.id = '3afa697d-7125-498e-b925-6b3656e9b4fe'
    ORDER BY vg.position
  `, [wsId]);
  console.log('Task Kanban ViewGroups:', vgs.rows);

  await c.end();
}

inspectTaskKanban().catch(console.error);

