const { Client } = require('pg');

async function inspectRecordPageLayout() {
  const c = new Client({
    connectionString: process.env.PG_DATABASE_URL || 'postgres://postgres:postgres@db:5432/default',
  });
  await c.connect();

  const wsId = '32c2a902-9983-4e13-b6f6-bc96609f8238';

  const r = await c.query(`
    SELECT pl.id as "layoutId", pl.name, pl.type, pt.id as "tabId", pt.title as "tabTitle", pw.id as "widgetId", pw.type as "widgetType", pw.configuration
    FROM core."pageLayout" pl
    JOIN core."pageLayoutTab" pt ON pt."pageLayoutId" = pl.id
    JOIN core."pageLayoutWidget" pw ON pw."pageLayoutTabId" = pt.id
    JOIN core."objectMetadata" om ON om.id = pl."objectMetadataId"
    WHERE pl."workspaceId" = $1 AND om."nameSingular" = 'task' AND pl.type = 'RECORD_PAGE'
  `, [wsId]);
  console.log('Task RECORD_PAGE Layout:', r.rows);

  await c.end();
}

inspectRecordPageLayout().catch(console.error);

