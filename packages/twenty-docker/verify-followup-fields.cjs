const { Client } = require('pg');

async function verifyFollowUps() {
  const c = new Client({
    connectionString: process.env.PG_DATABASE_URL || 'postgres://postgres:postgres@db:5432/default',
  });
  await c.connect();

  const wsId = '32c2a902-9983-4e13-b6f6-bc96609f8238';
  const schema = 'workspace_306npwj88jcxnl7zwdogk8bw8';

  console.log('🔍 VERIFYING REAL ESTATE FOLLOW-UPS MODULE CONFIGURATION\n');

  // 1. Verify Fields
  const taskObj = await c.query(`SELECT id, "labelIdentifierFieldMetadataId" FROM core."objectMetadata" WHERE "workspaceId" = $1 AND "nameSingular" = 'task'`, [wsId]);
  const taskId = taskObj.rows[0].id;

  const targetFields = ['followUpId', 'lead', 'relatedDeal', 'followUpType', 'dueAt', 'assignee', 'status', 'notes', 'nextFollowUpDate'];
  const fieldsRes = await c.query(`
    SELECT name, label, type, options, "defaultValue", "relationTargetObjectMetadataId"
    FROM core."fieldMetadata" 
    WHERE "workspaceId" = $1 AND "objectMetadataId" = $2 AND name = ANY($3)
  `, [wsId, taskId, targetFields]);

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

  // 2. Check Database Columns
  console.log('\n2. Database Columns in PostgreSQL:');
  const colsRes = await c.query(`
    SELECT column_name, data_type, udt_name 
    FROM information_schema.columns 
    WHERE table_schema = $1 AND table_name = 'task' AND column_name = ANY($2)
  `, [schema, ['followUpId', 'followUpType', 'leadId', 'relatedDealId', 'dueAt', 'assigneeId', 'status', 'notes', 'nextFollowUpDate']]);
  colsRes.rows.forEach(col => {
    console.log(`   - ${col.column_name}: ${col.data_type} (${col.udt_name})`);
  });

  // 3. Verify Creation Form (RECORD_FORM - "+ Create" Drawer)
  console.log('\n3. Creation Form Widgets (RECORD_FORM - "+ Create" Drawer):');
  const creationLayout = await c.query(`SELECT id FROM core."pageLayout" WHERE "workspaceId" = $1 AND "objectMetadataId" = $2 AND type = 'RECORD_FORM'`, [wsId, taskId]);
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
  console.log('\n4. Side Panel Fields (FIELDS_WIDGET view):');
  const fieldsWidgetView = await c.query(`SELECT id FROM core.view WHERE "workspaceId" = $1 AND "objectMetadataId" = $2 AND type = 'FIELDS_WIDGET'`, [wsId, taskId]);
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

  // 5. Verify Table View (All Follow-ups)
  console.log('\n5. Table View Columns ("All Follow-ups"):');
  const tableView = await c.query(`SELECT id, name FROM core.view WHERE "workspaceId" = $1 AND "objectMetadataId" = $2 AND "key" = 'INDEX'`, [wsId, taskId]);
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

  // 6. Verify Kanban View (All Follow-ups)
  console.log('\n6. Kanban View Groups:');
  const kanbanView = await c.query(`SELECT id FROM core.view WHERE "workspaceId" = $1 AND "objectMetadataId" = $2 AND type = 'KANBAN'`, [wsId, taskId]);
  const kGroups = await c.query(`SELECT "fieldValue", position, "isVisible" FROM core."viewGroup" WHERE "viewId" = $1 ORDER BY position`, [kanbanView.rows[0].id]);
  kGroups.rows.forEach(kg => {
    console.log(`   [Col ${kg.position}] ${kg.fieldValue} (visible: ${kg.isVisible})`);
  });

  // 7. Verify Sample Records in Schema
  console.log('\n7. Sample Follow-up Records in DB:');
  const sampleTasks = await c.query(`
    SELECT t."followUpId", t."followUpType", t.status, t."dueAt", t."nextFollowUpDate", t.notes,
           (p."nameFirstName" || ' ' || p."nameLastName") as "leadName",
           o.name as "dealName",
           (m."nameFirstName" || ' ' || m."nameLastName") as "agentName"
    FROM ${schema}.task t
    LEFT JOIN ${schema}.person p ON p.id = t."leadId"
    LEFT JOIN ${schema}.opportunity o ON o.id = t."relatedDealId"
    LEFT JOIN ${schema}."workspaceMember" m ON m.id = t."assigneeId"
    ORDER BY t."followUpId"
  `);
  sampleTasks.rows.forEach(t => {
    console.log(`   • ${t.followUpId} [${t.followUpType}] - Status: ${t.status} | Lead: ${t.leadName} | Deal: ${t.dealName || '(None)'} | Agent: ${t.agentName} | Due: ${t.dueAt.toISOString().slice(0, 16)} | Next: ${t.nextFollowUpDate ? t.nextFollowUpDate.toISOString().slice(0, 10) : 'N/A'}`);
    console.log(`     Notes: "${t.notes}"`);
  });

  await c.end();
}

verifyFollowUps().catch(console.error);

