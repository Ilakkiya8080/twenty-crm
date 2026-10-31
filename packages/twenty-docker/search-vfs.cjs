const { Client } = require('pg');

async function searchAllViewFields() {
  const c = new Client({
    connectionString: process.env.PG_DATABASE_URL || 'postgres://postgres:postgres@db:5432/default',
  });
  await c.connect();

  const wsId = '32c2a902-9983-4e13-b6f6-bc96609f8238';

  const r = await c.query(`
    SELECT vf.id, vf."viewId", v.name as "viewName", v.type as "viewType", v.key as "viewKey", fm.name as "fieldName", vf."isVisible", vf.position
    FROM core."viewField" vf
    JOIN core.view v ON v.id = vf."viewId"
    JOIN core."fieldMetadata" fm ON fm.id = vf."fieldMetadataId"
    WHERE v."objectMetadataId" = (SELECT id FROM core."objectMetadata" WHERE "workspaceId" = $1 AND "nameSingular" = 'task')
    ORDER BY vf."viewId", vf.position
  `, [wsId]);
  console.log('All view fields for task views:');
  r.rows.forEach(x => console.log(`${x.viewName} (${x.viewType}, key: ${x.viewKey}, id: ${x.viewId}) => ${x.fieldName} [pos: ${x.position}]`));

  await c.end();
}

searchAllViewFields().catch(console.error);

