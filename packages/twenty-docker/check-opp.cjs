const { Client } = require('pg');

async function checkOpp() {
  const c = new Client({
    connectionString: process.env.PG_DATABASE_URL || 'postgres://postgres:postgres@localhost:5432/default',
  });
  await c.connect();

  const obj = await c.query(`SELECT id, "nameSingular", "namePlural" FROM core."objectMetadata" WHERE "nameSingular" = 'opportunity'`);
  console.log('Object:', obj.rows);
  const objId = obj.rows[0].id;

  const layouts = await c.query(`SELECT id, name, type FROM core."pageLayout" WHERE "objectMetadataId" = $1`, [objId]);
  console.log('Layouts:', layouts.rows);

  const views = await c.query(`SELECT id, name, type, key FROM core.view WHERE "objectMetadataId" = $1`, [objId]);
  console.log('Views:', views.rows);

  for (const layout of layouts.rows) {
    const tabs = await c.query(`SELECT id, name FROM core."pageLayoutTab" WHERE "pageLayoutId" = $1`, [layout.id]);
    console.log(`Tabs for layout ${layout.name} (${layout.type}):`, tabs.rows);
    for (const tab of tabs.rows) {
      const widgets = await c.query(`
        SELECT id, name, type, "fieldMetadataId" 
        FROM core."pageLayoutWidget" 
        WHERE "pageLayoutTabId" = $1
      `, [tab.id]);
      console.log(`  Widgets for tab ${tab.name}:`, widgets.rows);
    }
  }

  const fields = await c.query(`SELECT id, name, label, type FROM core."fieldMetadata" WHERE "objectMetadataId" = $1`, [objId]);
  console.log('Fields:', fields.rows);

  await c.end();
}

checkOpp().catch(console.error);

