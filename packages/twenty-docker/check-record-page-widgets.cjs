const { Client } = require('pg');

async function run() {
  const c = new Client({
    connectionString: process.env.PG_DATABASE_URL || 'postgres://postgres:postgres@db:5432/default',
  });
  await c.connect();

  const wsId = '32c2a902-9983-4e13-b6f6-bc96609f8238';

  const r = await c.query(`
    SELECT om."nameSingular", pl.name as "layoutName", pl.type as "layoutType", pt.title as "tabTitle", pw.title as "widgetTitle", pw.type as "widgetType"
    FROM core."pageLayoutWidget" pw
    JOIN core."pageLayoutTab" pt ON pt.id = pw."pageLayoutTabId"
    JOIN core."pageLayout" pl ON pl.id = pt."pageLayoutId"
    JOIN core."objectMetadata" om ON om.id = pl."objectMetadataId"
    WHERE pl."workspaceId" = $1 AND om."nameSingular" IN ('task', 'opportunity') AND pl.type = 'RECORD_PAGE'
    ORDER BY om."nameSingular", pt.position, (pw.position->>'index')::int
  `);
  console.log('RECORD_PAGE widgets for task and opportunity:');
  r.rows.forEach(row => console.log(row));

  await c.end();
}

run().catch(console.error);

