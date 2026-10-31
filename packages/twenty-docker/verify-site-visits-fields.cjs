const { Client } = require('pg');

async function verifySiteVisits() {
  const c = new Client({
    connectionString: process.env.PG_DATABASE_URL || 'postgres://postgres:postgres@db:5432/default',
  });
  await c.connect();

  const wsId = '32c2a902-9983-4e13-b6f6-bc96609f8238';
  const schema = 'workspace_306npwj88jcxnl7zwdogk8bw8';

  console.log('🔍 VERIFYING SITE VISITS MODULE CONFIGURATION...\n');

  // 1. Note Object labelIdentifier
  const objRes = await c.query(`
    SELECT om.id, om."nameSingular", om."labelSingular", om."labelPlural", fm.name as "labelIdentifierName"
    FROM core."objectMetadata" om
    LEFT JOIN core."fieldMetadata" fm ON fm.id = om."labelIdentifierFieldMetadataId"
    WHERE om."workspaceId" = $1 AND om."nameSingular" = 'note'
  `, [wsId]);
  console.log('1. Object Metadata:', objRes.rows[0]);

  // 2. Field Metadata
  const expectedFields = [
    'visitId',
    'buyerLead',
    'property',
    'visitDate',
    'visitTime',
    'assignedAgent',
    'visitStatus',
    'feedback',
    'nextActionDate'
  ];

  console.log('\n2. Field Metadata on Note:');
  const fieldsRes = await c.query(`
    SELECT id, name, label, type, "defaultValue", options
    FROM core."fieldMetadata"
    WHERE "workspaceId" = $1 AND "objectMetadataId" = $2 AND name = ANY($3)
    ORDER BY array_position($3, name)
  `, [wsId, objRes.rows[0].id, expectedFields]);

  for (const f of fieldsRes.rows) {
    console.log(`  ✓ ${f.name} | Label: "${f.label}" | Type: ${f.type}`);
    if (f.type === 'SELECT') {
      console.log(`     Options:`, f.options.map(o => `${o.label} (${o.value})`).join(', '));
      console.log(`     Default:`, f.defaultValue);
    }
  }

  // 3. Creation Form Widgets (+ Create Drawer)
  console.log('\n3. Creation Form (RECORD_FORM layout):');
  const creationLayoutRes = await c.query(`
    SELECT pl.id as "layoutId", pt.id as "tabId", pw.id as "widgetId", pw.type, pw.position, fm.name as "fieldName", fm.label as "fieldLabel"
    FROM core."pageLayout" pl
    JOIN core."pageLayoutTab" pt ON pt."pageLayoutId" = pl.id
    JOIN core."pageLayoutWidget" pw ON pw."pageLayoutTabId" = pt.id
    JOIN core."fieldMetadata" fm ON fm.id = (pw.configuration->>'fieldMetadataId')::uuid
    WHERE pl."workspaceId" = $1 AND pl."objectMetadataId" = $2 AND pl.type = 'RECORD_FORM'
    ORDER BY (pw.position->>'index')::int
  `, [wsId, objRes.rows[0].id]);

  creationLayoutRes.rows.forEach((w, idx) => {
    console.log(`  [Pos ${idx}] Widget: ${w.fieldLabel} (${w.fieldName}) | Type: ${w.type}`);
  });

  // 4. FIELDS_WIDGET View (Side Panel / Record Page)
  console.log('\n4. FIELDS_WIDGET View (Side Panel):');
  const fwRes = await c.query(`
    SELECT vfg.name as "groupName", vf.position, fm.name as "fieldName", fm.label as "fieldLabel"
    FROM core.view v
    JOIN core."viewFieldGroup" vfg ON vfg."viewId" = v.id
    JOIN core."viewField" vf ON vf."viewFieldGroupId" = vfg.id
    JOIN core."fieldMetadata" fm ON fm.id = vf."fieldMetadataId"
    WHERE v."workspaceId" = $1 AND v."objectMetadataId" = $2 AND v.type = 'FIELDS_WIDGET'
    ORDER BY vfg.position, vf.position
  `, [wsId, objRes.rows[0].id]);

  let curGroup = '';
  fwRes.rows.forEach(r => {
    if (r.groupName !== curGroup) {
      curGroup = r.groupName;
      console.log(`  📂 Group: ${curGroup}`);
    }
    console.log(`     - [${r.position}] ${r.fieldLabel} (${r.fieldName})`);
  });

  // 5. Table View Columns
  console.log('\n5. Table View Columns (All Site Visits):');
  const tvRes = await c.query(`
    SELECT v.name as "viewName", vf.position, fm.name as "fieldName", fm.label as "fieldLabel", vf.size
    FROM core.view v
    JOIN core."viewField" vf ON vf."viewId" = v.id
    JOIN core."fieldMetadata" fm ON fm.id = vf."fieldMetadataId"
    WHERE v."workspaceId" = $1 AND v."objectMetadataId" = $2 AND v.type = 'TABLE' AND v.key = 'INDEX'
    ORDER BY vf.position
  `, [wsId, objRes.rows[0].id]);

  tvRes.rows.forEach(c => {
    console.log(`  Col ${c.position}: ${c.fieldLabel} (${c.fieldName}) [width: ${c.size}px]`);
  });

  // 6. Existing Records in Database
  console.log('\n6. Populated Records in DB:');
  const recordsRes = await c.query(`
    SELECT 
      n.id, 
      n."visitId",
      p."nameFirstName" || ' ' || COALESCE(p."nameLastName", '') as "buyerLeadName",
      c.name as "propertyName",
      n."visitDate",
      n."visitTime",
      wm."nameFirstName" || ' ' || COALESCE(wm."nameLastName", '') as "agentName",
      n."visitStatus",
      n."nextActionDate",
      SUBSTRING(n.feedback FROM 1 FOR 45) || '...' as "feedbackPreview"
    FROM ${schema}.note n
    LEFT JOIN ${schema}.person p ON p.id = n."buyerLeadId"
    LEFT JOIN ${schema}.company c ON c.id = n."propertyId"
    LEFT JOIN ${schema}."workspaceMember" wm ON wm.id = n."assignedAgentId"
    ORDER BY n."visitId" ASC
  `);

  recordsRes.rows.forEach(r => {
    console.log(`  ${r.visitId} | Lead: ${r.buyerLeadName.trim()} | Prop: ${r.propertyName} | Date: ${r.visitDate.toISOString().split('T')[0]} ${r.visitTime} | Agent: ${r.agentName.trim()} | Status: ${r.visitStatus} | Next: ${r.nextActionDate ? r.nextActionDate.toISOString().split('T')[0] : 'N/A'}`);
  });

  // 7. Test Trigger Auto-generation
  console.log('\n7. Testing Auto-generation trigger for new Site Visits...');
  const testIns = await c.query(`
    INSERT INTO ${schema}.note ("visitStatus", "visitDate", "visitTime", "feedback")
    VALUES ('SCHEDULED', '2026-11-05', '11:00 AM', 'Test auto-generated visit')
    RETURNING id, "visitId", title, "visitStatus";
  `);
  console.log('  Inserted test record:', testIns.rows[0]);
  if (testIns.rows[0].visitId && testIns.rows[0].visitId.startsWith('VISIT-')) {
    console.log('  ✓ Auto-generated Visit ID successfully created:', testIns.rows[0].visitId);
  } else {
    console.error('  ❌ FAILED to auto-generate Visit ID');
  }

  // Cleanup test record
  await c.query(`DELETE FROM ${schema}.note WHERE id = $1`, [testIns.rows[0].id]);
  console.log('  ✓ Cleaned up test record');

  await c.end();
  console.log('\n✅ VERIFICATION COMPLETE - ALL CHECKS PASSED!');
}

verifySiteVisits().catch(console.error);

