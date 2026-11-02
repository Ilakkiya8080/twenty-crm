const { Client } = require('pg');

async function checkKanban() {
  const c = new Client({
    connectionString: process.env.PG_DATABASE_URL || 'postgres://postgres:postgres@db:5432/default',
  });
  await c.connect();

  const wsId = '32c2a902-9983-4e13-b6f6-bc96609f8238';

  const kanban = await c.query(`
    SELECT v.id, v.name, v.type, v."mainGroupByFieldMetadataId", fm.name as "colName"
    FROM core.view v
    LEFT JOIN core."fieldMetadata" fm ON fm.id = v."mainGroupByFieldMetadataId"
    WHERE v."workspaceId" = $1 AND v.type = 'KANBAN' AND v."objectMetadataId" = (
      SELECT id FROM core."objectMetadata" WHERE "workspaceId" = $1 AND "nameSingular" = 'opportunity'
    )
  `, [wsId]);
  console.log('Kanban views for Deals:', kanban.rows);

  for (const k of kanban.rows) {
    const vg = await c.query(`SELECT id, "fieldValue", position, "isVisible" FROM core."viewGroup" WHERE "viewId" = $1 ORDER BY position`, [k.id]);
    console.log(`View groups for ${k.name}:`, vg.rows);
  }

  await c.end();
}

checkKanban().catch(console.error);

