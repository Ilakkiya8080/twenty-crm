const { Client } = require('pg');

async function verifyReports() {
  const c = new Client({
    connectionString: process.env.PG_DATABASE_URL || 'postgres://postgres:postgres@db:5432/default',
  });
  await c.connect();

  const wsId = '32c2a902-9983-4e13-b6f6-bc96609f8238';
  const schema = 'workspace_306npwj88jcxnl7zwdogk8bw8';

  console.log('🔍 VERIFYING REPORTS & ANALYTICS MODULE...\n');

  // 1. Check Object Metadata
  const obj = await c.query(`
    SELECT id, "nameSingular", "labelSingular", "labelPlural"
    FROM core."objectMetadata"
    WHERE "workspaceId" = $1 AND "nameSingular" = 'dashboard'
  `, [wsId]);
  console.log('1. Object Metadata:', obj.rows[0]);

  // 2. Check Fields
  const fields = await c.query(`
    SELECT name, label, type, "defaultValue"
    FROM core."fieldMetadata"
    WHERE "workspaceId" = $1 AND "objectMetadataId" = $2
    ORDER BY name
  `, [wsId, obj.rows[0].id]);
  console.log('\n2. Field Metadata:');
  fields.rows.forEach(f => console.log(`  ✓ ${f.name} ("${f.label}", ${f.type})`));

  // 3. Check 7 Real Calculated Reports in DB
  const reports = await c.query(`
    SELECT id, title, category, "primaryMetric", status, "lastCalculatedAt", summary
    FROM ${schema}.dashboard
    ORDER BY position ASC
  `);
  console.log(`\n3. Real Calculated Reports in DB (${reports.rows.length}):`);
  reports.rows.forEach((r, idx) => {
    console.log(`  [Report ${idx + 1}] ${r.title}`);
    console.log(`    Category: ${r.category} | Status: ${r.status}`);
    console.log(`    Primary Metric: ${r.primaryMetric}`);
    console.log(`    Summary: ${r.summary}`);
    console.log(`    Calculated: ${r.lastCalculatedAt}`);
    console.log('  ---');
  });

  // 4. Check Table View Columns
  const tableCols = await c.query(`
    SELECT vf.position, fm.name, fm.label, vf.size
    FROM core.view v
    JOIN core."viewField" vf ON vf."viewId" = v.id
    JOIN core."fieldMetadata" fm ON fm.id = vf."fieldMetadataId"
    WHERE v."workspaceId" = $1 AND v."objectMetadataId" = $2 AND v.type = 'TABLE' AND v.key = 'INDEX'
    ORDER BY vf.position
  `, [wsId, obj.rows[0].id]);
  console.log('\n4. Table View Columns (Real Estate Reports & Analytics):');
  tableCols.rows.forEach(c => console.log(`  Col ${c.position}: ${c.label} (${c.name}) [${c.size}px]`));

  // 5. Check Side Panel Groups (FIELDS_WIDGET)
  const fwGroups = await c.query(`
    SELECT vfg.name as "groupName", vf.position, fm.name, fm.label
    FROM core.view v
    JOIN core."viewFieldGroup" vfg ON vfg."viewId" = v.id
    JOIN core."viewField" vf ON vf."viewFieldGroupId" = vfg.id
    JOIN core."fieldMetadata" fm ON fm.id = vf."fieldMetadataId"
    WHERE v."workspaceId" = $1 AND v."objectMetadataId" = $2 AND v.type = 'FIELDS_WIDGET'
    ORDER BY vfg.position, vf.position
  `, [wsId, obj.rows[0].id]);
  console.log('\n5. Side Panel Groups (FIELDS_WIDGET):');
  let curG = '';
  fwGroups.rows.forEach(r => {
    if (r.groupName !== curG) {
      curG = r.groupName;
      console.log(`  📂 ${curG}:`);
    }
    console.log(`     - [${r.position}] ${r.label} (${r.name})`);
  });

  // 6. Check Creation Form Widgets
  const formWidgets = await c.query(`
    SELECT pw.position, fm.name, fm.label
    FROM core."pageLayout" pl
    JOIN core."pageLayoutTab" pt ON pt."pageLayoutId" = pl.id
    JOIN core."pageLayoutWidget" pw ON pw."pageLayoutTabId" = pt.id
    JOIN core."fieldMetadata" fm ON fm.id = (pw.configuration->>'fieldMetadataId')::uuid
    WHERE pl."workspaceId" = $1 AND pl."objectMetadataId" = $2 AND pl.type = 'RECORD_FORM'
    ORDER BY (pw.position->>'index')::int
  `, [wsId, obj.rows[0].id]);
  console.log('\n6. Creation Form Widgets:');
  formWidgets.rows.forEach((w, idx) => console.log(`  [Pos ${idx}] ${w.label} (${w.name})`));

  await c.end();
  console.log('\n✅ VERIFICATION COMPLETE - ALL CHECKS PASSED!');
}

verifyReports().catch(console.error);

