const { Client } = require('pg');

async function inspectTaskDetails() {
  const c = new Client({
    connectionString: process.env.PG_DATABASE_URL || 'postgres://postgres:postgres@db:5432/default',
  });
  await c.connect();

  const wsId = '32c2a902-9983-4e13-b6f6-bc96609f8238';
  const schema = 'workspace_306npwj88jcxnl7zwdogk8bw8';

  const taskObj = await c.query(`SELECT id FROM core."objectMetadata" WHERE "workspaceId" = $1 AND "nameSingular" = 'task'`, [wsId]);
  const taskId = taskObj.rows[0].id;
  console.log('Task Object ID:', taskId);

  const fields = await c.query(`
    SELECT id, name, label, type, options, "defaultValue", "relationTargetObjectMetadataId", settings
    FROM core."fieldMetadata" 
    WHERE "workspaceId" = $1 AND "objectMetadataId" = $2 
    ORDER BY name
  `, [wsId, taskId]);
  console.log('\nTask Fields:');
  fields.rows.forEach(f => {
    console.log(`- ${f.name} ("${f.label}", ${f.type}) ID: ${f.id} target: ${f.relationTargetObjectMetadataId}`);
    if (f.options) console.log('   Options:', f.options);
  });

  const layouts = await c.query(`SELECT id, name, type FROM core."pageLayout" WHERE "workspaceId" = $1 AND "objectMetadataId" = $2`, [wsId, taskId]);
  console.log('\nLayouts:');
  for (const l of layouts.rows) {
    console.log(`- Layout: ${l.name} (${l.type}) ID: ${l.id}`);
    const tabs = await c.query(`SELECT id, title, position FROM core."pageLayoutTab" WHERE "pageLayoutId" = $1 ORDER BY position`, [l.id]);
    for (const t of tabs.rows) {
      console.log(`    Tab: ${t.title} ID: ${t.id}`);
      const widgets = await c.query(`
        SELECT pw.id, pw.title, pw.type, pw.position, pw.configuration, fm.name as "fName"
        FROM core."pageLayoutWidget" pw
        LEFT JOIN core."fieldMetadata" fm ON fm.id = (pw.configuration->>'fieldMetadataId')::uuid
        WHERE pw."pageLayoutTabId" = $1
        ORDER BY pw.position->>'index'
      `, [t.id]);
      widgets.rows.forEach(w => {
        console.log(`      Widget: ${w.title || '(no title)'} | Type: ${w.type} | Field: ${w.fName} | pos: ${JSON.stringify(w.position)}`);
      });
    }
  }

  const views = await c.query(`SELECT id, name, type, key FROM core.view WHERE "workspaceId" = $1 AND "objectMetadataId" = $2 ORDER BY position`, [wsId, taskId]);
  console.log('\nViews:');
  views.rows.forEach(v => {
    console.log(`- ${v.name} (${v.type}, key: ${v.key}) ID: ${v.id}`);
  });

  const dbCols = await c.query(`
    SELECT column_name, data_type, udt_name 
    FROM information_schema.columns 
    WHERE table_schema = $1 AND table_name = 'task'
    ORDER BY ordinal_position
  `, [schema]);
  console.log('\nPhysical columns in task table:');
  dbCols.rows.forEach(col => {
    console.log(`  - ${col.column_name} (${col.data_type} / ${col.udt_name})`);
  });

  await c.end();
}

inspectTaskDetails().catch(console.error);

