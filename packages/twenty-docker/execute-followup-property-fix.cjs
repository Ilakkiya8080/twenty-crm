const { Client } = require('pg');

async function fixFollowUpModule() {
  const c = new Client({
    connectionString: process.env.PG_DATABASE_URL || 'postgres://postgres:postgres@db:5432/default',
  });
  await c.connect();

  const wsId = '32c2a902-9983-4e13-b6f6-bc96609f8238';
  const schema = 'workspace_306npwj88jcxnl7zwdogk8bw8';

  console.log('🚀 Enhancing Follow-ups Module with Related Property & All 10 Fields...');

  // 1. Applications & Object Metadata IDs
  const stdAppRes = await c.query(`SELECT id FROM core.application WHERE "workspaceId" = $1 AND name = 'Standard' LIMIT 1`, [wsId]);
  const customAppRes = await c.query(`SELECT id FROM core.application WHERE "workspaceId" = $1 AND name = 'Custom' LIMIT 1`, [wsId]);
  const stdAppId = stdAppRes.rows[0].id;
  const customAppId = customAppRes.rows.length > 0 ? customAppRes.rows[0].id : stdAppId;

  const taskObj = (await c.query(`SELECT id FROM core."objectMetadata" WHERE "workspaceId" = $1 AND "nameSingular" = 'task'`, [wsId])).rows[0];
  const personObj = (await c.query(`SELECT id FROM core."objectMetadata" WHERE "workspaceId" = $1 AND "nameSingular" = 'person'`, [wsId])).rows[0];
  const oppObj = (await c.query(`SELECT id FROM core."objectMetadata" WHERE "workspaceId" = $1 AND "nameSingular" = 'opportunity'`, [wsId])).rows[0];
  const companyObj = (await c.query(`SELECT id FROM core."objectMetadata" WHERE "workspaceId" = $1 AND "nameSingular" = 'company'`, [wsId])).rows[0];
  const memberObj = (await c.query(`SELECT id FROM core."objectMetadata" WHERE "workspaceId" = $1 AND "nameSingular" = 'workspaceMember'`, [wsId])).rows[0];

  const taskObjId = taskObj.id;
  const personObjId = personObj.id;
  const oppObjId = oppObj.id;
  const companyObjId = companyObj.id;
  const memberObjId = memberObj.id;

  // 2. Add relatedProperty column and Relation metadata
  console.log('🏢 Configuring Related Property Relation...');
  await c.query(`ALTER TABLE ${schema}.task ADD COLUMN IF NOT EXISTS "relatedPropertyId" uuid;`);

  let propRelTask = await c.query(`SELECT id FROM core."fieldMetadata" WHERE "workspaceId" = $1 AND "objectMetadataId" = $2 AND name = 'relatedProperty'`, [wsId, taskObjId]);
  let followUpsCompany = await c.query(`SELECT id FROM core."fieldMetadata" WHERE "workspaceId" = $1 AND "objectMetadataId" = $2 AND name = 'followUps'`, [wsId, companyObjId]);

  let propFieldId, companyFollowUpsFieldId;

  if (followUpsCompany.rows.length === 0) {
    const ins = await c.query(`
      INSERT INTO core."fieldMetadata" (
        id, "universalIdentifier", "objectMetadataId", "workspaceId", "applicationId",
        name, label, type, icon, description, settings, "isActive", "isSystem",
        "isUIEditable", "isUIReadOnly", "isNullable", "isLabelSyncedWithName",
        "relationTargetObjectMetadataId", "createdAt", "updatedAt"
      ) VALUES (
        gen_random_uuid(), gen_random_uuid(), $1, $2, $3,
        'followUps', 'Follow-ups', 'RELATION', 'IconPhoneCall', 'Follow-up actions and notes for this property listing',
        '{"relationType": "ONE_TO_MANY"}'::jsonb, true, false,
        false, false, false, false,
        $4, NOW(), NOW()
      ) RETURNING id;
    `, [companyObjId, wsId, customAppId, taskObjId]);
    companyFollowUpsFieldId = ins.rows[0].id;
  } else {
    companyFollowUpsFieldId = followUpsCompany.rows[0].id;
  }

  if (propRelTask.rows.length === 0) {
    const ins = await c.query(`
      INSERT INTO core."fieldMetadata" (
        id, "universalIdentifier", "objectMetadataId", "workspaceId", "applicationId",
        name, label, type, icon, description, settings, "isActive", "isSystem",
        "isUIEditable", "isUIReadOnly", "isNullable", "isLabelSyncedWithName",
        "relationTargetObjectMetadataId", "relationTargetFieldMetadataId", "createdAt", "updatedAt"
      ) VALUES (
        gen_random_uuid(), gen_random_uuid(), $1, $2, $3,
        'relatedProperty', 'Related Property', 'RELATION', 'IconBuildingSkyscraper', 'Property listing associated with this follow-up (optional)',
        '{"relationType": "MANY_TO_ONE", "joinColumnName": "relatedPropertyId"}'::jsonb, true, false,
        true, false, true, false,
        $4, $5, NOW(), NOW()
      ) RETURNING id;
    `, [taskObjId, wsId, customAppId, companyObjId, companyFollowUpsFieldId]);
    propFieldId = ins.rows[0].id;
  } else {
    propFieldId = propRelTask.rows[0].id;
    await c.query(`
      UPDATE core."fieldMetadata"
      SET label = 'Related Property', icon = 'IconBuildingSkyscraper', "relationTargetObjectMetadataId" = $1, "relationTargetFieldMetadataId" = $2, "updatedAt" = NOW()
      WHERE id = $3
    `, [companyObjId, companyFollowUpsFieldId, propFieldId]);
  }

  await c.query(`UPDATE core."fieldMetadata" SET "relationTargetFieldMetadataId" = $1 WHERE id = $2`, [propFieldId, companyFollowUpsFieldId]);
  console.log('  ✓ Linked task.relatedProperty <-> company.followUps');

  // Populate relatedPropertyId for existing records from taskTarget
  await c.query(`
    UPDATE ${schema}.task t
    SET "relatedPropertyId" = tt."targetCompanyId"
    FROM ${schema}."taskTarget" tt
    WHERE tt."taskId" = t.id AND tt."targetCompanyId" IS NOT NULL AND t."relatedPropertyId" IS NULL;
  `);
  console.log('  ✓ Populated existing tasks with relatedPropertyId from task targets');

  // 3. Ensure all 10 fields exist on task in core.fieldMetadata
  const fieldsRes = await c.query(`SELECT id, name FROM core."fieldMetadata" WHERE "workspaceId" = $1 AND "objectMetadataId" = $2`, [wsId, taskObjId]);
  const fMap = {};
  fieldsRes.rows.forEach(r => { fMap[r.name] = r.id; });

  const requiredFields = [
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

  console.log('\nChecking all 10 required fields:');
  for (const fn of requiredFields) {
    if (fMap[fn]) {
      console.log(`  ✓ ${fn}: ${fMap[fn]}`);
    } else {
      console.error(`  ❌ MISSING FIELD: ${fn}`);
    }
  }

  // 4. Configure Creation Form (RECORD_FORM layout - "+ Create" Drawer)
  console.log('\n📋 Updating Creation Form Layout (RECORD_FORM)...');
  const creationLayoutRes = await c.query(`SELECT id FROM core."pageLayout" WHERE "workspaceId" = $1 AND "objectMetadataId" = $2 AND type = 'RECORD_FORM'`, [wsId, taskObjId]);
  if (creationLayoutRes.rows.length > 0) {
    const creationLayoutId = creationLayoutRes.rows[0].id;
    const tabRes = await c.query(`SELECT id FROM core."pageLayoutTab" WHERE "pageLayoutId" = $1 LIMIT 1`, [creationLayoutId]);
    if (tabRes.rows.length > 0) {
      const tabId = tabRes.rows[0].id;
      await c.query(`DELETE FROM core."pageLayoutWidget" WHERE "pageLayoutTabId" = $1`, [tabId]);

      for (let i = 0; i < requiredFields.length; i++) {
        const fn = requiredFields[i];
        const fId = fMap[fn];
        if (fId) {
          await c.query(`
            INSERT INTO core."pageLayoutWidget" (
              id, "universalIdentifier", "pageLayoutTabId", "workspaceId", "applicationId",
              title, type, "objectMetadataId", "gridPosition", configuration,
              position, "isActive", "isSystemSideEffect", "createdAt", "updatedAt"
            ) VALUES (
              gen_random_uuid(), gen_random_uuid(), $1, $2, $3,
              '', 'FORM_FIELD', $4, $5, $6,
              $7, true, true, NOW(), NOW()
            )
          `, [
            tabId, wsId, stdAppId,
            taskObjId,
            JSON.stringify({ row: 0, column: 0, rowSpan: 1, columnSpan: 12 }),
            JSON.stringify({ fieldMetadataId: fId, configurationType: 'FORM_FIELD' }),
            JSON.stringify({ index: i, layoutMode: 'VERTICAL_LIST' }),
          ]);
        }
      }
      console.log('  ✓ Configured 10 FORM_FIELD widgets on Creation Form');
    }
  }

  // 5. Configure FIELDS_WIDGET View (Side Panel / Record Page)
  console.log('\n🗂️  Updating FIELDS_WIDGET View...');
  const fieldsWidgetViewRes = await c.query(`SELECT id FROM core.view WHERE "workspaceId" = $1 AND "objectMetadataId" = $2 AND type = 'FIELDS_WIDGET'`, [wsId, taskObjId]);
  if (fieldsWidgetViewRes.rows.length > 0) {
    const fwViewId = fieldsWidgetViewRes.rows[0].id;
    await c.query(`DELETE FROM core."viewField" WHERE "viewId" = $1`, [fwViewId]);
    await c.query(`DELETE FROM core."viewFieldGroup" WHERE "viewId" = $1`, [fwViewId]);

    const groupsDef = [
      {
        name: 'Follow-up Details',
        position: 0,
        fields: ['followUpId', 'followUpType', 'status', 'dueAt', 'nextFollowUpDate'],
      },
      {
        name: 'Associations',
        position: 1,
        fields: ['lead', 'relatedDeal', 'relatedProperty', 'assignee'],
      },
      {
        name: 'Notes',
        position: 2,
        fields: ['notes'],
      },
      {
        name: 'System',
        position: 3,
        fields: ['createdAt', 'createdBy', 'updatedAt', 'updatedBy'],
      },
    ];

    for (const g of groupsDef) {
      const gRes = await c.query(`
        INSERT INTO core."viewFieldGroup" (
          id, "universalIdentifier", name, position, "isVisible", "isActive",
          "viewId", "workspaceId", "applicationId", "createdAt", "updatedAt"
        ) VALUES (
          gen_random_uuid(), gen_random_uuid(), $1, $2, true, true,
          $3, $4, $5, NOW(), NOW()
        ) RETURNING id;
      `, [g.name, g.position, fwViewId, wsId, stdAppId]);
      const gId = gRes.rows[0].id;

      for (let pos = 0; pos < g.fields.length; pos++) {
        const fn = g.fields[pos];
        const fId = fMap[fn];
        if (fId) {
          await c.query(`
            INSERT INTO core."viewField" (
              id, "universalIdentifier", "viewId", "fieldMetadataId", "viewFieldGroupId",
              position, "isVisible", "isActive", size, "workspaceId", "applicationId",
              "createdAt", "updatedAt"
            ) VALUES (
              gen_random_uuid(), gen_random_uuid(), $1, $2, $3,
              $4, true, true, 200, $5, $6,
              NOW(), NOW()
            )
          `, [fwViewId, fId, gId, pos, wsId, stdAppId]);
        }
      }
    }
    console.log('  ✓ Rebuilt FIELDS_WIDGET groups with all fields');
  }

  // 6. Configure ALL Table Views (All Follow-ups)
  console.log('\n📊 Updating Table Views for Follow-ups...');
  const tableViewsRes = await c.query(`SELECT id, name FROM core.view WHERE "workspaceId" = $1 AND "objectMetadataId" = $2 AND type = 'TABLE'`, [wsId, taskObjId]);

  const tableColumnSizes = {
    followUpId: 130,
    lead: 180,
    relatedDeal: 220,
    relatedProperty: 220,
    followUpType: 140,
    dueAt: 180,
    assignee: 170,
    status: 130,
    notes: 260,
    nextFollowUpDate: 160,
  };

  for (const tv of tableViewsRes.rows) {
    await c.query(`DELETE FROM core."viewField" WHERE "viewId" = $1`, [tv.id]);
    for (let i = 0; i < requiredFields.length; i++) {
      const fn = requiredFields[i];
      const fId = fMap[fn];
      const sz = tableColumnSizes[fn] || 150;
      if (fId) {
        await c.query(`
          INSERT INTO core."viewField" (
            id, "universalIdentifier", "viewId", "fieldMetadataId",
            position, "isVisible", "isActive", size, "workspaceId", "applicationId",
            "createdAt", "updatedAt"
          ) VALUES (
            gen_random_uuid(), gen_random_uuid(), $1, $2,
            $3, true, true, $4, $5, $6,
            NOW(), NOW()
          )
        `, [tv.id, fId, i, sz, wsId, stdAppId]);
      }
    }
    console.log(`  ✓ Synced 10 columns to Table View: ${tv.name} (${tv.id})`);
  }

  // 7. Bump Workspace Metadata Cache Version
  await c.query(`UPDATE core.workspace SET "metadataVersion" = "metadataVersion" + 1 WHERE id = $1`, [wsId]);
  console.log('✨ Incremented workspace metadataVersion');

  await c.end();
  console.log('\n✅ Follow-up module updates complete!');
}

fixFollowUpModule().catch(console.error);

