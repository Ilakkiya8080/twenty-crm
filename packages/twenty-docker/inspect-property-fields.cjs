const { Client } = require('pg');

async function inspectPropertyModule() {
  const c = new Client({
    connectionString: process.env.PG_DATABASE_URL || 'postgres://postgres:postgres@db:5432/default',
  });
  await c.connect();

  const wsId = '32c2a902-9983-4e13-b6f6-bc96609f8238';
  const schema = 'workspace_306npwj88jcxnl7zwdogk8bw8';

  const om = (await c.query(`SELECT id, "nameSingular", "labelSingular", "labelPlural", "labelIdentifierFieldMetadataId" FROM core."objectMetadata" WHERE "workspaceId" = $1 AND "nameSingular" = 'company'`, [wsId])).rows[0];
  console.log('Object company:', om);

  const fields = (await c.query(`
    SELECT id, name, label, type, "isUIEditable", "isUIReadOnly", "isNullable"
    FROM core."fieldMetadata"
    WHERE "workspaceId" = $1 AND "objectMetadataId" = $2
    ORDER BY name
  `, [wsId, om.id])).rows;
  console.log('\nAll Fields on company:');
  fields.forEach(f => console.log(`  - ${f.name} ("${f.label}", ${f.type}) ID: ${f.id}`));

  const layouts = (await c.query(`
    SELECT id, name, type
    FROM core."pageLayout"
    WHERE "workspaceId" = $1 AND "objectMetadataId" = $2
  `, [wsId, om.id])).rows;
  console.log('\nLayouts on company:', layouts);

  for (const l of layouts) {
    console.log(`\nLayout: ${l.name} (${l.type}) ID: ${l.id}`);
    const tabs = await c.query(`SELECT id, title, position FROM core."pageLayoutTab" WHERE "pageLayoutId" = $1 ORDER BY position`, [l.id]);
    for (const t of tabs.rows) {
      console.log(`  Tab: ${t.title} (ID: ${t.id})`);
      const widgets = await c.query(`
        SELECT pw.id, pw.title, pw.type, pw.position, pw.configuration, fm.name as "fName", fm.label as "fLabel"
        FROM core."pageLayoutWidget" pw
        LEFT JOIN core."fieldMetadata" fm ON fm.id = (pw.configuration->>'fieldMetadataId')::uuid
        WHERE pw."pageLayoutTabId" = $1
        ORDER BY (pw.position->>'index')::int
      `, [t.id]);
      widgets.rows.forEach(w => console.log(`    Widget: ${w.fLabel || w.title || '(no title)'} (${w.fName}) | type: ${w.type} | pos: ${JSON.stringify(w.position)}`));
    }
  }

  const views = (await c.query(`
    SELECT id, name, type, key FROM core.view WHERE "workspaceId" = $1 AND "objectMetadataId" = $2
  `, [wsId, om.id])).rows;
  console.log('\nViews on company:', views);

  for (const v of views) {
    console.log(`\nView: ${v.name} (${v.type}, key: ${v.key}) ID: ${v.id}`);
    const groups = await c.query(`SELECT id, name, position FROM core."viewFieldGroup" WHERE "viewId" = $1 ORDER BY position`, [v.id]);
    if (groups.rows.length > 0) {
      for (const g of groups.rows) {
        console.log(`  Group: ${g.name} (pos: ${g.position})`);
        const vfs = await c.query(`
          SELECT vf.position, fm.name, fm.label
          FROM core."viewField" vf
          JOIN core."fieldMetadata" fm ON fm.id = vf."fieldMetadataId"
          WHERE vf."viewFieldGroupId" = $1
          ORDER BY vf.position
        `, [g.id]);
        vfs.rows.forEach(vf => console.log(`    - [${vf.position}] ${vf.label} (${vf.name})`));
      }
    } else {
      const vfs = await c.query(`
        SELECT vf.position, fm.name, fm.label, vf."isVisible", vf.size
        FROM core."viewField" vf
        JOIN core."fieldMetadata" fm ON fm.id = vf."fieldMetadataId"
        WHERE vf."viewId" = $1
        ORDER BY vf.position
      `, [v.id]);
      vfs.rows.forEach(vf => console.log(`    Col ${vf.position}: ${vf.label} (${vf.name}) [width: ${vf.size}px]`));
    }
  }

  await c.end();
}

inspectPropertyModule().catch(console.error);

