const { Client } = require('pg');

async function verifyDeals() {
  const c = new Client({
    connectionString: process.env.PG_DATABASE_URL || 'postgres://postgres:postgres@db:5432/default',
  });
  await c.connect();

  const wsId = '32c2a902-9983-4e13-b6f6-bc96609f8238';
  const schema = 'workspace_306npwj88jcxnl7zwdogk8bw8';

  console.log('🔍 VERIFYING REAL ESTATE DEALS MODULE CONFIGURATION\n');

  // 1. Verify Fields
  const oppObj = await c.query(`SELECT id FROM core."objectMetadata" WHERE "workspaceId" = $1 AND "nameSingular" = 'opportunity'`, [wsId]);
  const oppId = oppObj.rows[0].id;

  const targetFields = ['name', 'dealType', 'pointOfContact', 'company', 'owner', 'amount', 'closeDate', 'stage'];
  const fieldsRes = await c.query(`
    SELECT name, label, type, options, "defaultValue" 
    FROM core."fieldMetadata" 
    WHERE "workspaceId" = $1 AND "objectMetadataId" = $2 AND name = ANY($3)
  `, [wsId, oppId, targetFields]);

  console.log('1. Target Fields in core."fieldMetadata":');
  const fieldDict = {};
  fieldsRes.rows.forEach(r => { fieldDict[r.name] = r; });
  for (const fn of targetFields) {
    const f = fieldDict[fn];
    if (f) {
      console.log(`   ✓ ${f.name} => Label: "${f.label}", Type: ${f.type}`);
      if (f.options) {
        console.log(`     Options (${f.options.length}):`, f.options.map(o => `${o.label} (${o.value})`).join(', '));
      }
    } else {
      console.log(`   ❌ MISSING: ${fn}`);
    }
  }

  // 2. Check Database Column
  console.log('\n2. Database Column in PostgreSQL:');
  const colRes = await c.query(`
    SELECT column_name, data_type, udt_name 
    FROM information_schema.columns 
    WHERE table_schema = $1 AND table_name = 'opportunity' AND column_name = 'dealType'
  `, [schema]);
  console.log('   dealType column:', colRes.rows[0]);

  // 3. Verify Creation Form (RECORD_FORM layout)
  console.log('\n3. Creation Form Widgets (RECORD_FORM - "+ Create" Drawer):');
  const creationLayout = await c.query(`SELECT id FROM core."pageLayout" WHERE "workspaceId" = $1 AND "objectMetadataId" = $2 AND type = 'RECORD_FORM'`, [wsId, oppId]);
  const creationTab = await c.query(`SELECT id FROM core."pageLayoutTab" WHERE "pageLayoutId" = $1`, [creationLayout.rows[0].id]);
  const formWidgets = await c.query(`
    SELECT pw.position->>'index' as idx, fm.name, fm.label, pw.type
    FROM core."pageLayoutWidget" pw
    JOIN core."fieldMetadata" fm ON fm.id = (pw.configuration->>'fieldMetadataId')::uuid
    WHERE pw."pageLayoutTabId" = $1
    ORDER BY (pw.position->>'index')::int
  `, [creationTab.rows[0].id]);
  formWidgets.rows.forEach(w => {
    console.log(`   [Index ${w.idx}] ${w.label} (${w.name}) - ${w.type}`);
  });

  // 4. Verify Side Panel (FIELDS_WIDGET view)
  console.log('\n4. Side Panel / Record Page Fields (FIELDS_WIDGET view):');
  const fieldsWidgetView = await c.query(`SELECT id FROM core.view WHERE "workspaceId" = $1 AND "objectMetadataId" = $2 AND type = 'FIELDS_WIDGET'`, [wsId, oppId]);
  const groups = await c.query(`SELECT id, name, position FROM core."viewFieldGroup" WHERE "viewId" = $1 ORDER BY position`, [fieldsWidgetView.rows[0].id]);
  for (const g of groups.rows) {
    console.log(`   Group: "${g.name}"`);
    const vfs = await c.query(`
      SELECT vf.position, fm.name, fm.label 
      FROM core."viewField" vf
      JOIN core."fieldMetadata" fm ON fm.id = vf."fieldMetadataId"
      WHERE vf."viewFieldGroupId" = $1
      ORDER BY vf.position
    `, [g.id]);
    vfs.rows.forEach(vf => {
      console.log(`     - [Pos ${vf.position}] ${vf.label} (${vf.name})`);
    });
  }

  // 5. Verify Table View (All Deals)
  console.log('\n5. Table View Columns ("All Deals"):');
  const tableView = await c.query(`SELECT id, name FROM core.view WHERE "workspaceId" = $1 AND "objectMetadataId" = $2 AND "key" = 'INDEX'`, [wsId, oppId]);
  const tableCols = await c.query(`
    SELECT vf.position, fm.name, fm.label, vf.size
    FROM core."viewField" vf
    JOIN core."fieldMetadata" fm ON fm.id = vf."fieldMetadataId"
    WHERE vf."viewId" = $1
    ORDER BY vf.position
  `, [tableView.rows[0].id]);
  tableCols.rows.forEach(col => {
    console.log(`   [Col ${col.position}] ${col.label} (${col.name}) - width: ${col.size}px`);
  });

  // 6. Verify Sample Deals Data
  console.log('\n6. Sample Deals in Schema:');
  const sampleDeals = await c.query(`
    SELECT o.name, o."dealType", o.stage, (o."amountAmountMicros" / 1000000)::numeric as "amountUSD", (p."nameFirstName" || ' ' || p."nameLastName") as "customerName", c.name as "propertyName", (m."nameFirstName" || ' ' || m."nameLastName") as "agentName"
    FROM ${schema}.opportunity o
    LEFT JOIN ${schema}.person p ON p.id = o."pointOfContactId"
    LEFT JOIN ${schema}.company c ON c.id = o."companyId"
    LEFT JOIN ${schema}."workspaceMember" m ON m.id = o."ownerId"
    ORDER BY o.name
  `);
  sampleDeals.rows.forEach(d => {
    console.log(`   • ${d.name}`);
    console.log(`     Type: ${d.dealType} | Stage: ${d.stage} | Value: $${Number(d.amountUSD).toLocaleString()} | Customer: ${d.customerName} | Property: ${d.propertyName} | Agent: ${d.agentName}`);
  });

  await c.end();
}

verifyDeals().catch(console.error);
