const { Client } = require('pg');

async function inspectNote() {
  const c = new Client({
    connectionString: process.env.PG_DATABASE_URL || 'postgres://postgres:postgres@db:5432/default',
  });
  await c.connect();

  const wsId = '32c2a902-9983-4e13-b6f6-bc96609f8238';
  const schema = 'workspace_306npwj88jcxnl7zwdogk8bw8';

  const noteObj = await c.query(`SELECT id, "nameSingular", "namePlural", "labelSingular", "labelPlural", "labelIdentifierFieldMetadataId" FROM core."objectMetadata" WHERE "workspaceId" = $1 AND "nameSingular" = 'note'`, [wsId]);
  console.log('Note Object:', noteObj.rows[0]);
  const noteId = noteObj.rows[0].id;

  const fields = await c.query(`
    SELECT id, name, label, type, options, "defaultValue", "relationTargetObjectMetadataId", settings
    FROM core."fieldMetadata" 
    WHERE "workspaceId" = $1 AND "objectMetadataId" = $2 
    ORDER BY name
  `, [wsId, noteId]);
  console.log('\nNote Fields:');
  fields.rows.forEach(f => {
    console.log(`- ${f.name} ("${f.label}", ${f.type}) ID: ${f.id} target: ${f.relationTargetObjectMetadataId}`);
    if (f.options) console.log('   Options:', f.options);
  });

  const layouts = await c.query(`SELECT id, name, type FROM core."pageLayout" WHERE "workspaceId" = $1 AND "objectMetadataId" = $2`, [wsId, noteId]);
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

  const views = await c.query(`SELECT id, name, type, key FROM core.view WHERE "workspaceId" = $1 AND "objectMetadataId" = $2 ORDER BY position`, [wsId, noteId]);
  console.log('\nViews:');
  for (const v of views.rows) {
    console.log(`- View: ${v.name} (${v.type}, key: ${v.key}) ID: ${v.id}`);
    const vfs = await c.query(`
      SELECT vf.position, fm.name, fm.label, vf."isVisible"
      FROM core."viewField" vf
      JOIN core."fieldMetadata" fm ON fm.id = vf."fieldMetadataId"
      WHERE vf."viewId" = $1
      ORDER BY vf.position
    `, [v.id]);
    vfs.rows.forEach(vf => console.log(`    Col/Field: [${vf.position}] ${vf.label} (${vf.name}) visible: ${vf.isVisible}`));
  }

  const dbCols = await c.query(`
    SELECT column_name, data_type, udt_name 
    FROM information_schema.columns 
    WHERE table_schema = $1 AND table_name = 'note'
    ORDER BY ordinal_position
  `, [schema]);
  console.log('\nPhysical columns in note table:');
  dbCols.rows.forEach(col => {
    console.log(`  - ${col.column_name} (${col.data_type} / ${col.udt_name})`);
  });

  const sampleNotes = await c.query(`SELECT id, title, "bodyV2Markdown" FROM ${schema}.note LIMIT 5`).catch(() => ({ rows: [] }));
  console.log('\nSample notes:', sampleNotes.rows);

  const sampleNoteTargets = await c.query(`SELECT * FROM ${schema}."noteTarget" LIMIT 5`).catch(() => ({ rows: [] }));
  console.log('\nSample noteTargets:', sampleNoteTargets.rows);

  await c.end();
}

inspectNote().catch(console.error);

