const { Client } = require('pg');

async function verifyAll() {
  const c = new Client({
    connectionString: process.env.PG_DATABASE_URL || 'postgres://postgres:postgres@db:5432/default',
  });
  await c.connect();

  const wsId = '32c2a902-9983-4e13-b6f6-bc96609f8238';
  const schema = 'workspace_306npwj88jcxnl7zwdogk8bw8';

  console.log('🔍 FINAL VERIFICATION: FOLLOW-UPS MODULE WITH 10 FIELDS\n');

  const taskObj = (await c.query(`SELECT id FROM core."objectMetadata" WHERE "workspaceId" = $1 AND "nameSingular" = 'task'`, [wsId])).rows[0];
  const taskId = taskObj.id;

  const targetFields = [
    'followUpId',
    'lead',
    'relatedDeal',
    'relatedProperty',
    'followUpType',
    'dueAt',
    'assignee',
    'status',
    'notes',
    'nextFollowUpDate'
  ];

  console.log('1. Target Fields in core."fieldMetadata":');
  const fieldsRes = await c.query(`
    SELECT name, label, type, options 
    FROM core."fieldMetadata" 
    WHERE "workspaceId" = $1 AND "objectMetadataId" = $2 AND name = ANY($3)
  `, [wsId, taskId, targetFields]);
  const fMap = {};
  fieldsRes.rows.forEach(r => { fMap[r.name] = r; });

  targetFields.forEach((fn, idx) => {
    const f = fMap[fn];
    if (f) {
      console.log(`   [#${idx + 1}] ${f.name} => Label: "${f.label}", Type: ${f.type}`);
    } else {
      console.log(`   ❌ MISSING: ${fn}`);
    }
  });

  console.log('\n2. Creation Form Widgets (RECORD_FORM - "+ Create" Drawer):');
  const creationLayout = (await c.query(`SELECT id FROM core."pageLayout" WHERE "workspaceId" = $1 AND "objectMetadataId" = $2 AND type = 'RECORD_FORM'`, [wsId, taskId])).rows[0];
  const creationTab = (await c.query(`SELECT id FROM core."pageLayoutTab" WHERE "pageLayoutId" = $1`, [creationLayout.id])).rows[0];
  const formWidgets = await c.query(`
    SELECT pw.position->>'index' as idx, fm.name, fm.label, pw.type
    FROM core."pageLayoutWidget" pw
    JOIN core."fieldMetadata" fm ON fm.id = (pw.configuration->>'fieldMetadataId')::uuid
    WHERE pw."pageLayoutTabId" = $1
    ORDER BY (pw.position->>'index')::int
  `, [creationTab.id]);
  formWidgets.rows.forEach(w => {
    console.log(`   [Index ${w.idx}] ${w.label} (${w.name}) - ${w.type}`);
  });

  console.log('\n3. Side Panel / Record Page Groups & Fields (FIELDS_WIDGET view):');
  const fwView = (await c.query(`SELECT id FROM core.view WHERE "workspaceId" = $1 AND "objectMetadataId" = $2 AND type = 'FIELDS_WIDGET'`, [wsId, taskId])).rows[0];
  const groups = await c.query(`SELECT id, name, position FROM core."viewFieldGroup" WHERE "viewId" = $1 ORDER BY position`, [fwView.id]);
  for (const g of groups.rows) {
    console.log(`   Group: "${g.name}"`);
    const vfs = await c.query(`
      SELECT vf.position, fm.name, fm.label 
      FROM core."viewField" vf
      JOIN core."fieldMetadata" fm ON fm.id = vf."fieldMetadataId"
      WHERE vf."viewFieldGroupId" = $1
      ORDER BY vf.position
    `, [g.id]);
    vfs.rows.forEach(vf => console.log(`     - [Pos ${vf.position}] ${vf.label} (${vf.name})`));
  }

  console.log('\n4. Table View Columns ("All Follow-ups" - INDEX):');
  const tableView = (await c.query(`SELECT id, name FROM core.view WHERE "workspaceId" = $1 AND "objectMetadataId" = $2 AND "key" = 'INDEX'`, [wsId, taskId])).rows[0];
  const tableCols = await c.query(`
    SELECT vf.position, fm.name, fm.label, vf.size
    FROM core."viewField" vf
    JOIN core."fieldMetadata" fm ON fm.id = vf."fieldMetadataId"
    WHERE vf."viewId" = $1
    ORDER BY vf.position
  `, [tableView.id]);
  tableCols.rows.forEach(col => {
    console.log(`   [Col ${col.position}] ${col.label} (${col.name}) - width: ${col.size}px`);
  });

  console.log('\n5. Sample Follow-up Records in Database:');
  const tasks = await c.query(`
    SELECT t."followUpId", t."followUpType", t.status, t."dueAt", t."nextFollowUpDate", t.notes,
           (p."nameFirstName" || ' ' || p."nameLastName") as "leadName",
           o.name as "dealName",
           c.name as "propertyName",
           (m."nameFirstName" || ' ' || m."nameLastName") as "agentName"
    FROM ${schema}.task t
    LEFT JOIN ${schema}.person p ON p.id = t."leadId"
    LEFT JOIN ${schema}.opportunity o ON o.id = t."relatedDealId"
    LEFT JOIN ${schema}.company c ON c.id = t."relatedPropertyId"
    LEFT JOIN ${schema}."workspaceMember" m ON m.id = t."assigneeId"
    ORDER BY t."followUpId"
  `);
  tasks.rows.forEach(t => {
    console.log(`   • ${t.followUpId} [${t.followUpType}] - Status: ${t.status}`);
    console.log(`     Lead: ${t.leadName} | Deal: ${t.dealName || '(None)'} | Property: ${t.propertyName || '(None)'} | Agent: ${t.agentName}`);
    console.log(`     Due: ${t.dueAt ? t.dueAt.toISOString().slice(0, 16) : 'N/A'} | Next: ${t.nextFollowUpDate ? t.nextFollowUpDate.toISOString().slice(0, 10) : 'N/A'}`);
    console.log(`     Notes: "${t.notes}"`);
  });

  await c.end();
}

verifyAll().catch(console.error);

