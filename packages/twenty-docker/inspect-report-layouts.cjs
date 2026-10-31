const { Client } = require('pg');

async function inspectReportLayouts() {
  const c = new Client({
    connectionString: process.env.PG_DATABASE_URL || 'postgres://postgres:postgres@db:5432/default',
  });
  await c.connect();

  const wsId = '32c2a902-9983-4e13-b6f6-bc96609f8238';

  const r = await c.query(`
    SELECT pl.id, pl.name, pl.type, om."nameSingular"
    FROM core."pageLayout" pl
    JOIN core."objectMetadata" om ON om.id = pl."objectMetadataId"
    WHERE pl."workspaceId" = $1 AND om."nameSingular" = 'dashboard'
  `, [wsId]);
  console.log('Page layouts for dashboard:', r.rows);

  const widgets = await c.query(`
    SELECT pw.id, pw.title, pw.type, pt.title as "tabTitle", pl.name as "layoutName"
    FROM core."pageLayoutWidget" pw
    JOIN core."pageLayoutTab" pt ON pt.id = pw."pageLayoutTabId"
    JOIN core."pageLayout" pl ON pl.id = pt."pageLayoutId"
    JOIN core."objectMetadata" om ON om.id = pl."objectMetadataId"
    WHERE pl."workspaceId" = $1 AND om."nameSingular" = 'dashboard'
  `, [wsId]);
  console.log('Widgets for dashboard:', widgets.rows);

  await c.end();
}

inspectReportLayouts().catch(console.error);

