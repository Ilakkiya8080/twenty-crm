const { Client } = require('pg');

async function checkWhyOld() {
  const c = new Client({
    connectionString: process.env.PG_DATABASE_URL || 'postgres://postgres:postgres@db:5432/default',
  });
  await c.connect();

  const viewId = '3193249a-407b-45d2-9e62-82753ef22bb0';
  const vfs = await c.query(`
    SELECT vf.id, vf.position, vf."isVisible", fm.name, fm.label
    FROM core."viewField" vf
    JOIN core."fieldMetadata" fm ON fm.id = vf."fieldMetadataId"
    WHERE vf."viewId" = $1
    ORDER BY vf.position
  `, [viewId]);
  console.log('viewFields for 3193249a-407b-45d2-9e62-82753ef22bb0:');
  vfs.rows.forEach(r => console.log(r));

  // Let's also check RECORD_PAGE layout widgets for task
  const taskId = '2810523d-e043-441e-8963-357c7efda407';
  const recPage = await c.query(`
    SELECT pl.id, pl.name, pl.type, plt.id as "tabId", plt.title, pw.id as "widgetId", pw.title as "widgetTitle", pw.type as "widgetType", pw.configuration
    FROM core."pageLayout" pl
    JOIN core."pageLayoutTab" plt ON plt."pageLayoutId" = pl.id
    LEFT JOIN core."pageLayoutWidget" pw ON pw."pageLayoutTabId" = plt.id
    WHERE pl."objectMetadataId" = $1
  `, [taskId]);
  console.log('\nPage layouts and widgets for task:');
  recPage.rows.forEach(r => console.log(r));

  // What views exist for task?
  const allViews = await c.query(`SELECT id, name, type, key, "isCompact" FROM core.view WHERE "objectMetadataId" = $1`, [taskId]);
  console.log('\nAll views for task:');
  allViews.rows.forEach(r => console.log(r));

  // What viewFieldGroups exist for FIELDS_WIDGET?
  const fwView = allViews.rows.find(v => v.type === 'FIELDS_WIDGET');
  if (fwView) {
    const vfgs = await c.query(`SELECT id, name, position FROM core."viewFieldGroup" WHERE "viewId" = $1 ORDER BY position`, [fwView.id]);
    console.log('\nField groups for FIELDS_WIDGET:', vfgs.rows);
    const fwVfs = await c.query(`
      SELECT vf.position, vf."viewFieldGroupId", fm.name, fm.label
      FROM core."viewField" vf
      JOIN core."fieldMetadata" fm ON fm.id = vf."fieldMetadataId"
      WHERE vf."viewId" = $1
      ORDER BY vf.position
    `, [fwView.id]);
    console.log('viewFields for FIELDS_WIDGET:', fwVfs.rows);
  }

  await c.end();
}

checkWhyOld().catch(console.error);

