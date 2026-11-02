const { Client } = require('pg');

async function inspectDashboard() {
  const c = new Client({
    connectionString: process.env.PG_DATABASE_URL || 'postgres://postgres:postgres@db:5432/default',
  });
  await c.connect();

  const wsId = '32c2a902-9983-4e13-b6f6-bc96609f8238';
  const schema = 'workspace_306npwj88jcxnl7zwdogk8bw8';

  const om = await c.query(`
    SELECT id, "nameSingular", "namePlural", "labelSingular", "labelPlural", "isActive", "labelIdentifierFieldMetadataId"
    FROM core."objectMetadata"
    WHERE "workspaceId" = $1 AND ("nameSingular" = 'dashboard' OR "nameSingular" ILIKE '%report%')
  `, [wsId]);
  console.log('Object Metadata:', om.rows);

  if (om.rows.length > 0) {
    const objId = om.rows[0].id;
    const fields = await c.query(`
      SELECT id, name, label, type FROM core."fieldMetadata"
      WHERE "workspaceId" = $1 AND "objectMetadataId" = $2
    `, [wsId, objId]);
    console.log('\nFields on', om.rows[0].nameSingular, ':', fields.rows);

    const views = await c.query(`
      SELECT id, name, type, key, position FROM core.view
      WHERE "workspaceId" = $1 AND "objectMetadataId" = $2
    `, [wsId, objId]);
    console.log('\nViews:', views.rows);

    const layouts = await c.query(`
      SELECT id, name, type FROM core."pageLayout"
      WHERE "workspaceId" = $1 AND "objectMetadataId" = $2
    `, [wsId, objId]);
    console.log('\nLayouts:', layouts.rows);

    const cols = await c.query(`
      SELECT column_name, data_type FROM information_schema.columns
      WHERE table_schema = $1 AND table_name = $2
    `, [schema, om.rows[0].nameSingular]);
    console.log('\nPhysical columns:', cols.rows);

    const records = await c.query(`SELECT * FROM ${schema}.${om.rows[0].nameSingular}`);
    console.log('\nCurrent records in DB:', records.rows);
  }

  await c.end();
}

inspectDashboard().catch(console.error);

