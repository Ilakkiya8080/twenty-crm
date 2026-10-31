const { Client } = require('pg');

async function inspectActiveOpp() {
  const c = new Client({
    connectionString: process.env.PG_DATABASE_URL || 'postgres://postgres:postgres@db:5432/default',
  });
  await c.connect();

  const wsId = '32c2a902-9983-4e13-b6f6-bc96609f8238';
  const schema = 'workspace_306npwj88jcxnl7zwdogk8bw8';

  const oppObj = await c.query(`SELECT id FROM core."objectMetadata" WHERE "workspaceId" = $1 AND "nameSingular" = 'opportunity'`, [wsId]);
  const oppId = oppObj.rows[0].id;
  console.log('Opportunity Object ID:', oppId);

  const fields = await c.query(`SELECT id, name, label, type, options FROM core."fieldMetadata" WHERE "workspaceId" = $1 AND "objectMetadataId" = $2 ORDER BY name`, [wsId, oppId]);
  console.log('\nOpportunity Fields:');
  fields.rows.forEach(f => {
    console.log(`- ${f.name} ("${f.label}", ${f.type}) ID: ${f.id}`);
  });

  const layouts = await c.query(`SELECT id, name, type FROM core."pageLayout" WHERE "workspaceId" = $1 AND "objectMetadataId" = $2`, [wsId, oppId]);
  console.log('\nLayouts:');
  for (const l of layouts.rows) {
    console.log(`\nLayout: ${l.name} (${l.type}) ID: ${l.id}`);
    const tabs = await c.query(`SELECT id, title, position FROM core."pageLayoutTab" WHERE "pageLayoutId" = $1 ORDER BY position`, [l.id]);
    for (const t of tabs.rows) {
      console.log(`  Tab: ${t.title} (pos: ${t.position}) ID: ${t.id}`);
      const widgets = await c.query(`SELECT id, title, type, "gridPosition", position, configuration FROM core."pageLayoutWidget" WHERE "pageLayoutTabId" = $1 ORDER BY position->>'index'`, [t.id]);
      for (const w of widgets.rows) {
        console.log(`    Widget: ${w.title || '(no title)'} | Type: ${w.type} | FieldId: ${w.configuration ? w.configuration.fieldMetadataId : ''} | pos: ${JSON.stringify(w.position)}`);
      }
    }
  }

  const views = await c.query(`SELECT id, name, type, key FROM core.view WHERE "workspaceId" = $1 AND "objectMetadataId" = $2 ORDER BY position`, [wsId, oppId]);
  console.log('\nViews:');
  for (const v of views.rows) {
    console.log(`- View: ${v.name} (${v.type}, key: ${v.key}) ID: ${v.id}`);
    if (v.type === 'FIELDS_WIDGET') {
      const groups = await c.query(`SELECT id, name, position FROM core."viewFieldGroup" WHERE "viewId" = $1 ORDER BY position`, [v.id]);
      for (const g of groups.rows) {
        console.log(`    Group: ${g.name} (pos: ${g.position}) ID: ${g.id}`);
        const vfs = await c.query(`
          SELECT vf.id, vf.position, fm.name, fm.label 
          FROM core."viewField" vf 
          JOIN core."fieldMetadata" fm ON fm.id = vf."fieldMetadataId" 
          WHERE vf."viewId" = $1 AND vf."viewFieldGroupId" = $2 
          ORDER BY vf.position
        `, [v.id, g.id]);
        for (const vf of vfs.rows) {
          console.log(`      Field: ${vf.name} ("${vf.label}") pos: ${vf.position}`);
        }
      }
    } else if (v.type === 'TABLE' && v.key === 'INDEX') {
      const vfs = await c.query(`
        SELECT vf.id, vf.position, vf."isVisible", fm.name, fm.label 
        FROM core."viewField" vf 
        JOIN core."fieldMetadata" fm ON fm.id = vf."fieldMetadataId" 
        WHERE vf."viewId" = $1 
        ORDER BY vf.position
      `, [v.id]);
      console.log('    Table Columns:');
      for (const vf of vfs.rows) {
        console.log(`      Col: ${vf.name} ("${vf.label}") pos: ${vf.position} visible: ${vf.isVisible}`);
      }
    }
  }

  await c.end();
}

inspectActiveOpp().catch(console.error);

