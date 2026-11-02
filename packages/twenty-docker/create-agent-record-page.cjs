const { Client } = require('pg');

async function createAgentRecordPage() {
  const c = new Client({
    connectionString: process.env.PG_DATABASE_URL || 'postgres://postgres:postgres@db:5432/default',
  });
  await c.connect();

  const wsId = '32c2a902-9983-4e13-b6f6-bc96609f8238';
  const schema = 'workspace_306npwj88jcxnl7zwdogk8bw8';

  console.log('🚀 Creating complete Record Page & Fields Screen for Agents module...');

  // 1. Get Application & Member Object Metadata IDs
  const appRes = await c.query(`SELECT id FROM core.application WHERE "workspaceId" = $1 AND name = 'Custom' LIMIT 1`, [wsId]);
  const appId = appRes.rows[0].id;

  const stdAppRes = await c.query(`SELECT id FROM core.application WHERE "workspaceId" = $1 AND name = 'Standard' LIMIT 1`, [wsId]);
  const stdAppId = stdAppRes.rows.length > 0 ? stdAppRes.rows[0].id : appId;

  const memberObjRes = await c.query(`SELECT id FROM core."objectMetadata" WHERE "workspaceId" = $1 AND "nameSingular" = 'workspaceMember'`, [wsId]);
  const memberObjId = memberObjRes.rows[0].id;

  // 2. Fetch all field metadata IDs for workspaceMember
  const fieldsRes = await c.query(`SELECT id, name FROM core."fieldMetadata" WHERE "objectMetadataId" = $1`, [memberObjId]);
  const fieldMap = {};
  fieldsRes.rows.forEach(r => { fieldMap[r.name] = r.id; });

  // 3. Create or Update FIELDS_WIDGET View in core.view
  console.log('📄 Creating FIELDS_WIDGET View for Agent Side Panel...');
  let fieldsWidgetViewId;
  const existingViewRes = await c.query(`
    SELECT id FROM core.view 
    WHERE "workspaceId" = $1 AND "objectMetadataId" = $2 AND type = 'FIELDS_WIDGET'
  `, [wsId, memberObjId]);

  if (existingViewRes.rows.length > 0) {
    fieldsWidgetViewId = existingViewRes.rows[0].id;
    console.log('  ↻ Existing FIELDS_WIDGET View found:', fieldsWidgetViewId);
  } else {
    const newViewRes = await c.query(`
      INSERT INTO core.view (
        id, "universalIdentifier", name, "objectMetadataId", type, icon, position,
        "isCompact", "isCustom", "openRecordIn", "workspaceId", "applicationId",
        visibility, "isActive", "isSystemSideEffect", "groupLoadLimit", "createdAt", "updatedAt"
      ) VALUES (
        gen_random_uuid(), gen_random_uuid(), 'Agent Record Page Fields', $1, 'FIELDS_WIDGET', 'IconListDetails', 0,
        false, false, 'SIDE_PANEL', $2, $3,
        'WORKSPACE', true, true, 8, NOW(), NOW()
      ) RETURNING id;
    `, [memberObjId, wsId, stdAppId]);
    fieldsWidgetViewId = newViewRes.rows[0].id;
    console.log('  ✓ Created new FIELDS_WIDGET View:', fieldsWidgetViewId);
  }

  // 4. Create ViewFieldGroups in core."viewFieldGroup"
  console.log('📂 Setting up Field Groups in Agent side panel...');
  await c.query(`DELETE FROM core."viewField" WHERE "viewId" = $1`, [fieldsWidgetViewId]);
  await c.query(`DELETE FROM core."viewFieldGroup" WHERE "viewId" = $1`, [fieldsWidgetViewId]);

  const groupsDef = [
    { name: 'General', position: 0 },
    { name: 'Contact Information', position: 1 },
    { name: 'Real Estate Credentials', position: 2 },
    { name: 'Assigned Portfolio', position: 3 },
    { name: 'System Info', position: 4 },
  ];

  const groupMap = {};
  for (const g of groupsDef) {
    const gRes = await c.query(`
      INSERT INTO core."viewFieldGroup" (
        id, "universalIdentifier", name, position, "viewId", "workspaceId", "applicationId",
        "createdAt", "updatedAt"
      ) VALUES (
        gen_random_uuid(), gen_random_uuid(), $1, $2, $3, $4, $5,
        NOW(), NOW()
      ) RETURNING id;
    `, [g.name, g.position, fieldsWidgetViewId, wsId, stdAppId]);
    groupMap[g.name] = gRes.rows[0].id;
  }

  // 5. Add ViewFields into Groups
  console.log('📝 Linking all 13 Agent fields to side panel groups...');
  const groupFields = [
    // General
    { name: 'name', group: 'General', pos: 0 },
    { name: 'agentId', group: 'General', pos: 1 },
    { name: 'status', group: 'General', pos: 2 },
    { name: 'jobTitle', group: 'General', pos: 3 },
    // Contact Information
    { name: 'userEmail', group: 'Contact Information', pos: 0 },
    { name: 'phoneNumber', group: 'Contact Information', pos: 1 },
    { name: 'location', group: 'Contact Information', pos: 2 },
    // Real Estate Credentials
    { name: 'specialization', group: 'Real Estate Credentials', pos: 0 },
    { name: 'licenseNumber', group: 'Real Estate Credentials', pos: 1 },
    { name: 'experienceYears', group: 'Real Estate Credentials', pos: 2 },
    { name: 'commissionRate', group: 'Real Estate Credentials', pos: 3 },
    { name: 'joiningDate', group: 'Real Estate Credentials', pos: 4 },
    // Assigned Portfolio
    { name: 'accountOwnerForCompanies', group: 'Assigned Portfolio', pos: 0 },
    { name: 'ownedOpportunities', group: 'Assigned Portfolio', pos: 1 },
    { name: 'assignedAgentForPeople', group: 'Assigned Portfolio', pos: 2 },
    { name: 'assignedTasks', group: 'Assigned Portfolio', pos: 3 },
    // System
    { name: 'createdAt', group: 'System Info', pos: 0 },
    { name: 'createdBy', group: 'System Info', pos: 1 },
    { name: 'updatedAt', group: 'System Info', pos: 2 },
    { name: 'updatedBy', group: 'System Info', pos: 3 },
  ];

  for (const item of groupFields) {
    const fId = fieldMap[item.name];
    const gId = groupMap[item.group];
    if (fId && gId) {
      await c.query(`
        INSERT INTO core."viewField" (
          id, "universalIdentifier", "viewId", "fieldMetadataId", "viewFieldGroupId",
          position, "isVisible", size, "workspaceId", "applicationId", "createdAt", "updatedAt"
        ) VALUES (
          gen_random_uuid(), gen_random_uuid(), $1, $2, $3,
          $4, true, 200, $5, $6, NOW(), NOW()
        );
      `, [fieldsWidgetViewId, fId, gId, item.pos, wsId, stdAppId]);
    }
  }

  // 6. Create RECORD_PAGE Layout in core."pageLayout"
  console.log('🎨 Creating RECORD_PAGE Layout for Agents...');
  let pageLayoutId;
  const existingLayoutRes = await c.query(`
    SELECT id FROM core."pageLayout" 
    WHERE "workspaceId" = $1 AND "objectMetadataId" = $2 AND type = 'RECORD_PAGE'
  `, [wsId, memberObjId]);

  if (existingLayoutRes.rows.length > 0) {
    pageLayoutId = existingLayoutRes.rows[0].id;
    console.log('  ↻ Existing RECORD_PAGE Layout found:', pageLayoutId);
  } else {
    const newLayoutRes = await c.query(`
      INSERT INTO core."pageLayout" (
        id, "universalIdentifier", name, "workspaceId", "applicationId",
        type, "objectMetadataId", "isFirstTabPinned", "isSystemSideEffect",
        "createdAt", "updatedAt"
      ) VALUES (
        gen_random_uuid(), gen_random_uuid(), 'Default Agent Layout', $1, $2,
        'RECORD_PAGE', $3, true, true,
        NOW(), NOW()
      ) RETURNING id;
    `, [wsId, stdAppId, memberObjId]);
    pageLayoutId = newLayoutRes.rows[0].id;
    console.log('  ✓ Created new RECORD_PAGE Layout:', pageLayoutId);
  }

  // Delete existing tabs & widgets for this layout to ensure clean slate
  const oldTabs = await c.query(`SELECT id FROM core."pageLayoutTab" WHERE "pageLayoutId" = $1`, [pageLayoutId]);
  if (oldTabs.rows.length > 0) {
    const oldTabIds = oldTabs.rows.map(t => t.id);
    await c.query(`DELETE FROM core."pageLayoutWidget" WHERE "pageLayoutTabId" = ANY($1)`, [oldTabIds]);
    await c.query(`DELETE FROM core."pageLayoutTab" WHERE "pageLayoutId" = $1`, [pageLayoutId]);
  }

  // 7. Create Tabs: Home, Timeline, Tasks
  const homeTabRes = await c.query(`
    INSERT INTO core."pageLayoutTab" (
      id, "universalIdentifier", title, "workspaceId", position, "pageLayoutId",
      icon, "layoutMode", "isActive", "isSystemSideEffect", "applicationId", "createdAt", "updatedAt"
    ) VALUES (
      gen_random_uuid(), gen_random_uuid(), 'Home', $1, 10, $2,
      'IconHome', 'VERTICAL_LIST', true, true, $3, NOW(), NOW()
    ) RETURNING id;
  `, [wsId, pageLayoutId, stdAppId]);
  const homeTabId = homeTabRes.rows[0].id;

  const timelineTabRes = await c.query(`
    INSERT INTO core."pageLayoutTab" (
      id, "universalIdentifier", title, "workspaceId", position, "pageLayoutId",
      icon, "layoutMode", "isActive", "isSystemSideEffect", "applicationId", "createdAt", "updatedAt"
    ) VALUES (
      gen_random_uuid(), gen_random_uuid(), 'Timeline', $1, 20, $2,
      'IconTimelineEvent', 'VERTICAL_LIST', true, true, $3, NOW(), NOW()
    ) RETURNING id;
  `, [wsId, pageLayoutId, stdAppId]);
  const timelineTabId = timelineTabRes.rows[0].id;

  const tasksTabRes = await c.query(`
    INSERT INTO core."pageLayoutTab" (
      id, "universalIdentifier", title, "workspaceId", position, "pageLayoutId",
      icon, "layoutMode", "isActive", "isSystemSideEffect", "applicationId", "createdAt", "updatedAt"
    ) VALUES (
      gen_random_uuid(), gen_random_uuid(), 'Tasks', $1, 30, $2,
      'IconCheckbox', 'VERTICAL_LIST', true, true, $3, NOW(), NOW()
    ) RETURNING id;
  `, [wsId, pageLayoutId, stdAppId]);
  const tasksTabId = tasksTabRes.rows[0].id;

  // 8. Create Widgets on Home Tab
  console.log('🧩 Creating widgets on Home tab...');
  // 8.1. Fields Widget
  await c.query(`
    INSERT INTO core."pageLayoutWidget" (
      id, "universalIdentifier", "pageLayoutTabId", "workspaceId", "applicationId",
      title, type, "gridPosition", position, configuration, "isActive", "isSystemSideEffect",
      "createdAt", "updatedAt"
    ) VALUES (
      gen_random_uuid(), gen_random_uuid(), $1, $2, $3,
      'Fields', 'FIELDS', '{"row":0,"column":0,"rowSpan":1,"columnSpan":12}', '{"layoutMode":"VERTICAL_LIST","index":0}',
      $4, true, true,
      NOW(), NOW()
    );
  `, [homeTabId, wsId, stdAppId, JSON.stringify({
    viewId: fieldsWidgetViewId,
    configurationType: 'FIELDS',
    newFieldDefaultVisibility: true
  })]);

  // 8.2. Assigned Properties Card Widget
  if (fieldMap['accountOwnerForCompanies']) {
    await c.query(`
      INSERT INTO core."pageLayoutWidget" (
        id, "universalIdentifier", "pageLayoutTabId", "workspaceId", "applicationId",
        title, type, "gridPosition", position, configuration, "isActive", "isSystemSideEffect",
        "createdAt", "updatedAt"
      ) VALUES (
        gen_random_uuid(), gen_random_uuid(), $1, $2, $3,
        'Assigned Properties', 'FIELD', '{"row":0,"column":0,"rowSpan":1,"columnSpan":12}', '{"layoutMode":"VERTICAL_LIST","index":1}',
        $4, true, true,
        NOW(), NOW()
      );
    `, [homeTabId, wsId, stdAppId, JSON.stringify({
      fieldMetadataId: fieldMap['accountOwnerForCompanies'],
      fieldDisplayMode: 'CARD',
      configurationType: 'FIELD'
    })]);
  }

  // 8.3. Deals Card Widget
  if (fieldMap['ownedOpportunities']) {
    await c.query(`
      INSERT INTO core."pageLayoutWidget" (
        id, "universalIdentifier", "pageLayoutTabId", "workspaceId", "applicationId",
        title, type, "gridPosition", position, configuration, "isActive", "isSystemSideEffect",
        "createdAt", "updatedAt"
      ) VALUES (
        gen_random_uuid(), gen_random_uuid(), $1, $2, $3,
        'Deals', 'FIELD', '{"row":0,"column":0,"rowSpan":1,"columnSpan":12}', '{"layoutMode":"VERTICAL_LIST","index":2}',
        $4, true, true,
        NOW(), NOW()
      );
    `, [homeTabId, wsId, stdAppId, JSON.stringify({
      fieldMetadataId: fieldMap['ownedOpportunities'],
      fieldDisplayMode: 'CARD',
      configurationType: 'FIELD'
    })]);
  }

  // Timeline Widget
  await c.query(`
    INSERT INTO core."pageLayoutWidget" (
      id, "universalIdentifier", "pageLayoutTabId", "workspaceId", "applicationId",
      title, type, "gridPosition", position, configuration, "isActive", "isSystemSideEffect",
      "createdAt", "updatedAt"
    ) VALUES (
      gen_random_uuid(), gen_random_uuid(), $1, $2, $3,
      'Timeline', 'TIMELINE', '{"row":0,"column":0,"rowSpan":1,"columnSpan":12}', '{"layoutMode":"VERTICAL_LIST","index":0}',
      '{"configurationType":"TIMELINE"}', true, true,
      NOW(), NOW()
    );
  `, [timelineTabId, wsId, stdAppId]);

  // Tasks Widget
  await c.query(`
    INSERT INTO core."pageLayoutWidget" (
      id, "universalIdentifier", "pageLayoutTabId", "workspaceId", "applicationId",
      title, type, "gridPosition", position, configuration, "isActive", "isSystemSideEffect",
      "createdAt", "updatedAt"
    ) VALUES (
      gen_random_uuid(), gen_random_uuid(), $1, $2, $3,
      'Tasks', 'TASKS', '{"row":0,"column":0,"rowSpan":1,"columnSpan":12}', '{"layoutMode":"VERTICAL_LIST","index":0}',
      '{"configurationType":"TASKS"}', true, true,
      NOW(), NOW()
    );
  `, [tasksTabId, wsId, stdAppId]);

  // 9. Populate RECORD_FORM Layout widgets
  console.log('📋 Populating RECORD_FORM widgets for modal creation...');
  const recordFormTab = await c.query(`
    SELECT t.id FROM core."pageLayoutTab" t
    JOIN core."pageLayout" pl ON pl.id = t."pageLayoutId"
    WHERE pl."workspaceId" = $1 AND pl."objectMetadataId" = $2 AND pl.type = 'RECORD_FORM'
    LIMIT 1;
  `, [wsId, memberObjId]);

  if (recordFormTab.rows.length > 0) {
    const formTabId = recordFormTab.rows[0].id;
    await c.query(`DELETE FROM core."pageLayoutWidget" WHERE "pageLayoutTabId" = $1`, [formTabId]);

    const formFields = [
      'name', 'agentId', 'userEmail', 'phoneNumber', 'specialization',
      'location', 'status', 'licenseNumber', 'experienceYears', 'commissionRate', 'joiningDate'
    ];

    for (let i = 0; i < formFields.length; i++) {
      const fn = formFields[i];
      const fId = fieldMap[fn];
      if (fId) {
        await c.query(`
          INSERT INTO core."pageLayoutWidget" (
            id, "universalIdentifier", "pageLayoutTabId", "workspaceId", "applicationId",
            title, type, "gridPosition", position, configuration, "isActive", "isSystemSideEffect",
            "createdAt", "updatedAt"
          ) VALUES (
            gen_random_uuid(), gen_random_uuid(), $1, $2, $3,
            '', 'FORM_FIELD', '{"row":0,"column":0,"rowSpan":1,"columnSpan":12}',
            $4, $5, true, true, NOW(), NOW()
          );
        `, [
          formTabId, wsId, stdAppId,
          JSON.stringify({ layoutMode: 'VERTICAL_LIST', index: i }),
          JSON.stringify({ fieldMetadataId: fId, configurationType: 'FORM_FIELD' })
        ]);
      }
    }
    console.log('  ✓ Populated FORM_FIELD widgets on RECORD_FORM');
  }

  // 10. Clean up empty/null records created during testing
  console.log('🧹 Cleaning up blank test rows in table...');
  const cleanRes = await c.query(`
    DELETE FROM ${schema}."workspaceMember" 
    WHERE ("nameFirstName" IS NULL OR "nameFirstName" = '') 
      AND ("userEmail" IS NULL OR "userEmail" = '');
  `);
  console.log(`  ✓ Cleaned up ${cleanRes.rowCount} empty test rows`);

  // 11. Invalidate Caches
  console.log('🔄 Bumping metadataVersion...');
  await c.query(`UPDATE core.workspace SET "metadataVersion" = "metadataVersion" + 1 WHERE id = $1`, [wsId]);

  console.log('🎉 Done! Agent side panel and record creation screens are fully configured!');
  await c.end();
}

createAgentRecordPage().catch(console.error);

