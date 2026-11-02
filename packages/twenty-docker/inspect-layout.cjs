const { Client } = require('pg');

async function inspectLayoutTables() {
  const c = new Client({
    connectionString: process.env.PG_DATABASE_URL || 'postgres://postgres:postgres@db:5432/default',
  });
  await c.connect();

  const tabCols = await c.query(`SELECT column_name, data_type FROM information_schema.columns WHERE table_schema = 'core' AND table_name = 'pageLayoutTab'`);
  console.log('pageLayoutTab columns:', tabCols.rows.map(r => r.column_name));

  const widgetCols = await c.query(`SELECT column_name, data_type FROM information_schema.columns WHERE table_schema = 'core' AND table_name = 'pageLayoutWidget'`);
  console.log('pageLayoutWidget columns:', widgetCols.rows.map(r => r.column_name));

  const layoutCols = await c.query(`SELECT column_name, data_type FROM information_schema.columns WHERE table_schema = 'core' AND table_name = 'pageLayout'`);
  console.log('pageLayout columns:', layoutCols.rows.map(r => r.column_name));

  // Let's also check opportunity layouts specifically
  const oppObj = await c.query(`SELECT id FROM core."objectMetadata" WHERE "nameSingular" = 'opportunity'`);
  const oppId = oppObj.rows[0].id;
  const oppLayouts = await c.query(`SELECT * FROM core."pageLayout" WHERE "objectMetadataId" = $1`, [oppId]);
  console.log('Opportunity layouts:', oppLayouts.rows);

  for (const l of oppLayouts.rows) {
    const tabs = await c.query(`SELECT * FROM core."pageLayoutTab" WHERE "pageLayoutId" = $1`, [l.id]);
    console.log(`Tabs for layout ${l.id} (${l.name}):`, tabs.rows);
    for (const t of tabs.rows) {
      const widgets = await c.query(`SELECT * FROM core."pageLayoutWidget" WHERE "pageLayoutTabId" = $1`, [t.id]);
      console.log(`  Widgets for tab ${t.id} (${t.title}):`, widgets.rows);
    }
  }

  await c.end();
}

inspectLayoutTables().catch(console.error);

