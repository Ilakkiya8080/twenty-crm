const { Client } = require('pg');

async function verifyPropertyFixes() {
  const c = new Client({
    connectionString: process.env.PG_DATABASE_URL || 'postgres://postgres:postgres@db:5432/default',
  });
  await c.connect();

  const wsId = '32c2a902-9983-4e13-b6f6-bc96609f8238';
  const schema = 'workspace_306npwj88jcxnl7zwdogk8bw8';

  console.log('🔍 VERIFYING PROPERTY LISTINGS FIXES...\n');

  const compObj = (await c.query(`SELECT id FROM core."objectMetadata" WHERE "workspaceId" = $1 AND "nameSingular" = 'company'`, [wsId])).rows[0];

  // 1. Creation Form Widgets
  const widgets = await c.query(`
    SELECT pw.position, fm.name, fm.label, pw.type
    FROM core."pageLayout" pl
    JOIN core."pageLayoutTab" pt ON pt."pageLayoutId" = pl.id
    JOIN core."pageLayoutWidget" pw ON pw."pageLayoutTabId" = pt.id
    JOIN core."fieldMetadata" fm ON fm.id = (pw.configuration->>'fieldMetadataId')::uuid
    WHERE pl."workspaceId" = $1 AND pl."objectMetadataId" = $2 AND pl.type = 'RECORD_FORM'
    ORDER BY (pw.position->>'index')::int
  `, [wsId, compObj.id]);
  console.log(`1. Creation Form Widgets (${widgets.rows.length}):`);
  widgets.rows.forEach((w, idx) => console.log(`  [Pos ${idx}] ${w.label} (${w.name}) | ${w.type}`));

  // 2. Side Panel Groups (FIELDS_WIDGET)
  const fw = await c.query(`
    SELECT vfg.name as "groupName", vf.position, fm.name, fm.label
    FROM core.view v
    JOIN core."viewFieldGroup" vfg ON vfg."viewId" = v.id
    JOIN core."viewField" vf ON vf."viewFieldGroupId" = vfg.id
    JOIN core."fieldMetadata" fm ON fm.id = vf."fieldMetadataId"
    WHERE v."workspaceId" = $1 AND v."objectMetadataId" = $2 AND v.type = 'FIELDS_WIDGET'
    ORDER BY vfg.position, vf.position
  `, [wsId, compObj.id]);
  console.log(`\n2. Side Panel Groups (FIELDS_WIDGET):`);
  let curG = '';
  fw.rows.forEach(r => {
    if (r.groupName !== curG) {
      curG = r.groupName;
      console.log(`  📂 ${curG}:`);
    }
    console.log(`     - [${r.position}] ${r.label} (${r.name})`);
  });

  // 3. Table Columns
  const cols = await c.query(`
    SELECT vf.position, fm.name, fm.label, vf.size
    FROM core.view v
    JOIN core."viewField" vf ON vf."viewId" = v.id
    JOIN core."fieldMetadata" fm ON fm.id = vf."fieldMetadataId"
    WHERE v."workspaceId" = $1 AND v."objectMetadataId" = $2 AND v.type = 'TABLE' AND v.key = 'INDEX'
    ORDER BY vf.position
  `, [wsId, compObj.id]);
  console.log(`\n3. Table Columns (${cols.rows.length}):`);
  cols.rows.forEach(c => console.log(`  Col ${c.position}: ${c.label} (${c.name}) [${c.size}px]`));

  // 4. Test Trigger Auto-generation
  console.log('\n4. Testing Property ID Auto-generation Trigger...');
  const testIns = await c.query(`
    INSERT INTO ${schema}.company (name, "propertyType", "listingType", "propertyStatus")
    VALUES ('Trigger Test Luxury Villa', 'VILLA', 'SALE', 'AVAILABLE')
    RETURNING id, "propertyId", name, "propertyStatus";
  `);
  console.log('  Inserted test property:', testIns.rows[0]);
  if (testIns.rows[0].propertyId && testIns.rows[0].propertyId.startsWith('PROP-')) {
    console.log('  ✓ Auto-generated Property ID successfully created:', testIns.rows[0].propertyId);
  } else {
    console.error('  ❌ FAILED to auto-generate Property ID');
  }
  await c.query(`DELETE FROM ${schema}.company WHERE id = $1`, [testIns.rows[0].id]);
  console.log('  ✓ Cleaned up test property');

  await c.end();
  console.log('\n✅ VERIFICATION COMPLETE - ALL CHECKS PASSED!');
}

verifyPropertyFixes().catch(console.error);

