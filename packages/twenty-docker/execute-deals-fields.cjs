const { Client } = require('pg');

async function provisionDealsFields() {
  const c = new Client({
    connectionString: process.env.PG_DATABASE_URL || 'postgres://postgres:postgres@db:5432/default',
  });
  await c.connect();

  const wsId = '32c2a902-9983-4e13-b6f6-bc96609f8238';
  const schema = 'workspace_306npwj88jcxnl7zwdogk8bw8';

  console.log('🚀 Starting Deals Module Field Provisioning for Real Estate CRM...');

  // 1. Fetch Applications
  const stdAppRes = await c.query(`SELECT id FROM core.application WHERE "workspaceId" = $1 AND name = 'Standard' LIMIT 1`, [wsId]);
  const customAppRes = await c.query(`SELECT id FROM core.application WHERE "workspaceId" = $1 AND name = 'Custom' LIMIT 1`, [wsId]);
  const stdAppId = stdAppRes.rows.length > 0 ? stdAppRes.rows[0].id : null;
  const customAppId = customAppRes.rows.length > 0 ? customAppRes.rows[0].id : stdAppId;

  // 2. Fetch Object Metadata for opportunity
  const oppObjRes = await c.query(`
    SELECT id FROM core."objectMetadata" 
    WHERE "workspaceId" = $1 AND "nameSingular" = 'opportunity'
  `, [wsId]);
  if (oppObjRes.rows.length === 0) {
    throw new Error('Opportunity object metadata not found');
  }
  const oppObjId = oppObjRes.rows[0].id;
  console.log('✓ Opportunity Object ID:', oppObjId);

  // 3. Update Existing Standard Fields to Match Real Estate Requirements
  console.log('✏️  Updating existing standard fields on opportunity...');
  
  // 3.1 Deal Name (name, Text)
  await c.query(`
    UPDATE core."fieldMetadata" 
    SET label = 'Deal Name', icon = 'IconFileText', description = 'Title or designation of the real estate deal'
    WHERE "workspaceId" = $1 AND "objectMetadataId" = $2 AND name = 'name'
  `, [wsId, oppObjId]);

  // 3.2 Customer (pointOfContact, Relation -> Customers / person)
  await c.query(`
    UPDATE core."fieldMetadata" 
    SET label = 'Customer', icon = 'IconUser', description = 'Prospective buyer or tenant associated with this deal'
    WHERE "workspaceId" = $1 AND "objectMetadataId" = $2 AND name = 'pointOfContact'
  `, [wsId, oppObjId]);

  // 3.3 Property (company, Relation -> Properties / company)
  await c.query(`
    UPDATE core."fieldMetadata" 
    SET label = 'Property', icon = 'IconBuildingSkyscraper', description = 'Property listing involved in this transaction'
    WHERE "workspaceId" = $1 AND "objectMetadataId" = $2 AND name = 'company'
  `, [wsId, oppObjId]);

  // 3.4 Agent (owner, Relation -> Agents / workspaceMember)
  await c.query(`
    UPDATE core."fieldMetadata" 
    SET label = 'Agent', icon = 'IconUserCheck', description = 'Real estate agent or broker handling this deal'
    WHERE "workspaceId" = $1 AND "objectMetadataId" = $2 AND name = 'owner'
  `, [wsId, oppObjId]);

  // 3.5 Deal Value (amount, Currency)
  await c.query(`
    UPDATE core."fieldMetadata" 
    SET label = 'Deal Value', icon = 'IconCurrencyDollar', description = 'Total agreed price or lease value for this deal'
    WHERE "workspaceId" = $1 AND "objectMetadataId" = $2 AND name = 'amount'
  `, [wsId, oppObjId]);

  // 3.6 Expected Closing Date (closeDate, Date)
  await c.query(`
    UPDATE core."fieldMetadata" 
    SET label = 'Expected Closing Date', icon = 'IconCalendar', description = 'Anticipated deal completion or signing date'
    WHERE "workspaceId" = $1 AND "objectMetadataId" = $2 AND name = 'closeDate'
  `, [wsId, oppObjId]);

  // 3.7 Stage (stage, Select: New, Negotiation, Site Visit, Documentation, Closed Won, Closed Lost)
  const stageOptions = [
    { id: '50505050-0001-4afd-9c39-d2063097587a', color: 'sky', label: 'New', value: 'NEW', position: 0 },
    { id: '50505050-0002-4671-ac32-26d304dacb6e', color: 'yellow', label: 'Negotiation', value: 'NEGOTIATION', position: 1 },
    { id: '50505050-0003-4671-ac32-26d304dacb6f', color: 'blue', label: 'Site Visit', value: 'SITE_VISIT', position: 2 },
    { id: '50505050-0004-4acc-b5ca-f6531a8ecb4a', color: 'purple', label: 'Documentation', value: 'DOCUMENTATION', position: 3 },
    { id: '50505050-0005-4f6b-91bc-f413e9b2f654', color: 'green', label: 'Closed Won', value: 'CLOSED_WON', position: 4 },
    { id: '50505050-0006-4a6f-a8b2-774bbad21104', color: 'red', label: 'Closed Lost', value: 'CLOSED_LOST', position: 5 },
  ];

  await c.query(`
    UPDATE core."fieldMetadata" 
    SET label = 'Stage', 
        icon = 'IconProgressCheck', 
        description = 'Select: New, Negotiation, Site Visit, Documentation, Closed Won, Closed Lost',
        options = $1,
        "defaultValue" = $2
    WHERE "workspaceId" = $3 AND "objectMetadataId" = $4 AND name = 'stage'
  `, [JSON.stringify(stageOptions), JSON.stringify("'NEW'"), wsId, oppObjId]);
  console.log('  ✓ Updated standard fields & stage options');

  // 4. Create or Update Deal Type (dealType, Select: Sale, Rental)
  console.log('➕ Creating / updating "dealType" in core."fieldMetadata"...');
  const dealTypeOptions = [
    { id: '60606060-0001-4000-8000-000000000001', color: 'blue', label: 'Sale', value: 'SALE', position: 0 },
    { id: '60606060-0002-4000-8000-000000000002', color: 'green', label: 'Rental', value: 'RENTAL', position: 1 },
  ];

  const existingDealType = await c.query(`
    SELECT id FROM core."fieldMetadata" 
    WHERE "workspaceId" = $1 AND "objectMetadataId" = $2 AND name = 'dealType'
  `, [wsId, oppObjId]);

  let dealTypeFieldId;
  if (existingDealType.rows.length === 0) {
    const insertRes = await c.query(`
      INSERT INTO core."fieldMetadata" (
        id, "universalIdentifier", "objectMetadataId", "workspaceId", "applicationId",
        name, label, type, icon, description, options, "defaultValue",
        "isActive", "isSystem", "isUIEditable", "isUIReadOnly", "isNullable", "isLabelSyncedWithName",
        "createdAt", "updatedAt"
      ) VALUES (
        gen_random_uuid(), gen_random_uuid(), $1, $2, $3,
        'dealType', 'Deal Type', 'SELECT', 'IconTag', 'Select: Sale, Rental', $4, $5,
        true, false, true, false, true, false,
        NOW(), NOW()
      ) RETURNING id
    `, [oppObjId, wsId, customAppId, JSON.stringify(dealTypeOptions), JSON.stringify("'SALE'")]);
    dealTypeFieldId = insertRes.rows[0].id;
    console.log('  ✓ Created fieldMetadata: dealType (ID:', dealTypeFieldId, ')');
  } else {
    dealTypeFieldId = existingDealType.rows[0].id;
    await c.query(`
      UPDATE core."fieldMetadata" 
      SET label = 'Deal Type',
          icon = 'IconTag',
          description = 'Select: Sale, Rental',
          options = $1,
          "defaultValue" = $2,
          "isActive" = true,
          "isUIEditable" = true,
          "updatedAt" = NOW()
      WHERE id = $3
    `, [JSON.stringify(dealTypeOptions), JSON.stringify("'SALE'"), dealTypeFieldId]);
    console.log('  ↻ Updated fieldMetadata: dealType (ID:', dealTypeFieldId, ')');
  }

  // 5. Database Schema: Enum & Column in PostgreSQL
  console.log('🐘 Ensuring database enum and column in schema:', schema);
  await c.query(`
    DO $$
    BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace WHERE t.typname = 'opportunity_dealType_enum' AND n.nspname = '${schema}') THEN
        CREATE TYPE ${schema}."opportunity_dealType_enum" AS ENUM ('SALE', 'RENTAL');
      END IF;
    END $$;
  `);

  await c.query(`
    ALTER TABLE ${schema}.opportunity 
    ADD COLUMN IF NOT EXISTS "dealType" ${schema}."opportunity_dealType_enum" DEFAULT 'SALE';
  `);
  console.log('  ✓ Column "dealType" is ready in PostgreSQL');

  // 6. Update existing deals with proper dealType, clean stage, and ensure relations
  console.log('📊 Updating existing Deal records with real estate data...');
  // Delete empty test record
  await c.query(`DELETE FROM ${schema}.opportunity WHERE id = 'e4f69b67-3a83-4e7a-b74a-85aa6343c5f9'`);

  // Update deals data
  const dealsData = [
    {
      id: '66666666-0001-4000-8000-000000000001',
      name: 'Skyline Grand Penthouse Purchase - Alexander Wright',
      dealType: 'SALE',
      stage: 'NEGOTIATION',
      pointOfContactId: '44444444-0001-4000-8000-000000000001',
    },
    {
      id: '66666666-0002-4000-8000-000000000002',
      name: 'Emerald Valley Villa 4B Acquisition - Sophia Martinez',
      dealType: 'SALE',
      stage: 'DOCUMENTATION',
      pointOfContactId: '44444444-0002-4000-8000-000000000002',
    },
    {
      id: '66666666-0003-4000-8000-000000000003',
      name: 'Oasis Commercial Plaza 5-Year Lease - Devin Chen',
      dealType: 'RENTAL',
      stage: 'SITE_VISIT',
      pointOfContactId: '44444444-0003-4000-8000-000000000003',
    },
    {
      id: '66666666-0004-4000-8000-000000000004',
      name: 'Grand Horizon Apt 1204 Annual Lease - Priya Sharma',
      dealType: 'RENTAL',
      stage: 'DOCUMENTATION',
      pointOfContactId: '44444444-0004-4000-8000-000000000004',
    },
    {
      id: '66666666-0005-4000-8000-000000000005',
      name: "Sunset Bay Waterfront Villa Closing - Michael O'Connor",
      dealType: 'SALE',
      stage: 'CLOSED_WON',
      pointOfContactId: '44444444-0005-4000-8000-000000000005',
    },
    {
      id: '66666666-0006-4000-8000-000000000006',
      name: 'Harmony Heights 3BHK Purchase - Rachel Green',
      dealType: 'SALE',
      stage: 'NEW',
      pointOfContactId: '44444444-0006-4000-8000-000000000006',
    },
    {
      id: '66666666-0007-4000-8000-000000000007',
      name: 'Silicon Square Tech Hub Acquisition - Vikram Patel',
      dealType: 'SALE',
      stage: 'NEGOTIATION',
      pointOfContactId: '44444444-0007-4000-8000-000000000007',
    },
    {
      id: '66666666-0008-4000-8000-000000000008',
      name: 'Greenfield Villa Plot 18 Contract - Emma Watson',
      dealType: 'SALE',
      stage: 'NEW',
      pointOfContactId: '44444444-0008-4000-8000-000000000008',
    },
  ];

  for (const d of dealsData) {
    await c.query(`
      UPDATE ${schema}.opportunity 
      SET name = $1,
          "dealType" = $2::${schema}."opportunity_dealType_enum",
          stage = $3::${schema}."opportunity_stage_enum",
          "pointOfContactId" = $4
      WHERE id = $5
    `, [d.name, d.dealType, d.stage, d.pointOfContactId, d.id]);
  }
  console.log('  ✓ Cleaned up and updated sample deals');

  // 7. Fetch all field IDs on opportunity for layouts and views
  const allFieldsRes = await c.query(`
    SELECT id, name FROM core."fieldMetadata" 
    WHERE "workspaceId" = $1 AND "objectMetadataId" = $2
  `, [wsId, oppObjId]);
  const fMap = {};
  allFieldsRes.rows.forEach(r => { fMap[r.name] = r.id; });

  // 8. Configure Creation Form (RECORD_FORM layout) - for clicking "+ Create"
  console.log('📋 Configuring Creation Form (RECORD_FORM layout)...');
  const creationLayoutRes = await c.query(`
    SELECT id FROM core."pageLayout" 
    WHERE "workspaceId" = $1 AND "objectMetadataId" = $2 AND type = 'RECORD_FORM'
  `, [wsId, oppObjId]);

  if (creationLayoutRes.rows.length > 0) {
    const creationLayoutId = creationLayoutRes.rows[0].id;
    const tabRes = await c.query(`
      SELECT id FROM core."pageLayoutTab" 
      WHERE "pageLayoutId" = $1 ORDER BY position LIMIT 1
    `, [creationLayoutId]);

    if (tabRes.rows.length > 0) {
      const tabId = tabRes.rows[0].id;

      // Delete existing widgets on this tab
      await c.query(`DELETE FROM core."pageLayoutWidget" WHERE "pageLayoutTabId" = $1`, [tabId]);

      // Fields in exact requested order:
      // 1. Deal Name (name)
      // 2. Deal Type (dealType)
      // 3. Customer (pointOfContact)
      // 4. Property (company)
      // 5. Agent (owner)
      // 6. Deal Value (amount)
      // 7. Expected Closing Date (closeDate)
      // 8. Stage (stage)
      const formFields = [
        'name',
        'dealType',
        'pointOfContact',
        'company',
        'owner',
        'amount',
        'closeDate',
        'stage',
      ];

      for (let i = 0; i < formFields.length; i++) {
        const fieldName = formFields[i];
        const fieldId = fMap[fieldName];
        if (fieldId) {
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
            oppObjId,
            JSON.stringify({ row: 0, column: 0, rowSpan: 1, columnSpan: 12 }),
            JSON.stringify({ fieldMetadataId: fieldId, configurationType: 'FORM_FIELD' }),
            JSON.stringify({ index: i, layoutMode: 'VERTICAL_LIST' }),
          ]);
        }
      }
      console.log('  ✓ Configured 8 FORM_FIELD widgets on Creation Form');
    }
  }

  // 9. Configure FIELDS_WIDGET View (Side Panel / Record Page Fields)
  console.log('🗂️  Configuring FIELDS_WIDGET View (Side Panel / Record Page)...');
  const fieldsWidgetViewRes = await c.query(`
    SELECT id FROM core.view 
    WHERE "workspaceId" = $1 AND "objectMetadataId" = $2 AND type = 'FIELDS_WIDGET'
  `, [wsId, oppObjId]);

  let fieldsWidgetViewId;
  if (fieldsWidgetViewRes.rows.length > 0) {
    fieldsWidgetViewId = fieldsWidgetViewRes.rows[0].id;
  } else {
    const newViewRes = await c.query(`
      INSERT INTO core.view (
        id, "universalIdentifier", name, "objectMetadataId", type, icon, position,
        "isCompact", "isCustom", "openRecordIn", "workspaceId", "applicationId",
        visibility, "isActive", "isSystemSideEffect", "groupLoadLimit", "createdAt", "updatedAt"
      ) VALUES (
        gen_random_uuid(), gen_random_uuid(), 'Opportunity Record Page Fields', $1, 'FIELDS_WIDGET', 'IconListDetails', 0,
        false, false, 'SIDE_PANEL', $2, $3,
        'WORKSPACE', true, true, 8, NOW(), NOW()
      ) RETURNING id;
    `, [oppObjId, wsId, stdAppId]);
    fieldsWidgetViewId = newViewRes.rows[0].id;
  }

  // Clear existing groups and viewFields
  await c.query(`DELETE FROM core."viewField" WHERE "viewId" = $1`, [fieldsWidgetViewId]);
  await c.query(`DELETE FROM core."viewFieldGroup" WHERE "viewId" = $1`, [fieldsWidgetViewId]);

  // Create groups: "Deal Details", "Stakeholders & Property", "System"
  const groupDefs = [
    {
      name: 'Deal Details',
      position: 0,
      fields: ['name', 'dealType', 'amount', 'stage', 'closeDate'],
    },
    {
      name: 'Stakeholders & Property',
      position: 1,
      fields: ['pointOfContact', 'company', 'owner'],
    },
    {
      name: 'System',
      position: 2,
      fields: ['createdAt', 'createdBy', 'updatedAt', 'updatedBy'],
    },
  ];

  for (const g of groupDefs) {
    const gRes = await c.query(`
      INSERT INTO core."viewFieldGroup" (
        id, "universalIdentifier", name, position, "viewId", "workspaceId", "applicationId",
        "createdAt", "updatedAt"
      ) VALUES (
        gen_random_uuid(), gen_random_uuid(), $1, $2, $3, $4, $5,
        NOW(), NOW()
      ) RETURNING id;
    `, [g.name, g.position, fieldsWidgetViewId, wsId, stdAppId]);
    const groupId = gRes.rows[0].id;

    for (let fIdx = 0; fIdx < g.fields.length; fIdx++) {
      const fName = g.fields[fIdx];
      const fId = fMap[fName];
      if (fId) {
        await c.query(`
          INSERT INTO core."viewField" (
            id, "universalIdentifier", "viewId", "fieldMetadataId", "viewFieldGroupId",
            position, "isVisible", size, "workspaceId", "applicationId",
            "createdAt", "updatedAt"
          ) VALUES (
            gen_random_uuid(), gen_random_uuid(), $1, $2, $3,
            $4, true, 200, $5, $6,
            NOW(), NOW()
          )
        `, [fieldsWidgetViewId, fId, groupId, fIdx, wsId, stdAppId]);
      }
    }
  }
  console.log('  ✓ Configured side panel groups & fields in FIELDS_WIDGET view');

  // 10. Configure "All Deals" Table View
  console.log('📊 Configuring "All Deals" Table View...');
  const tableViewRes = await c.query(`
    SELECT id FROM core.view 
    WHERE "workspaceId" = $1 AND "objectMetadataId" = $2 AND "key" = 'INDEX'
  `, [wsId, oppObjId]);

  if (tableViewRes.rows.length > 0) {
    const tableViewId = tableViewRes.rows[0].id;

    await c.query(`
      UPDATE core.view 
      SET name = 'All Deals', icon = 'IconCurrencyDollar' 
      WHERE id = $1
    `, [tableViewId]);

    await c.query(`DELETE FROM core."viewField" WHERE "viewId" = $1`, [tableViewId]);

    const tableColumns = [
      { name: 'name', size: 280 },
      { name: 'dealType', size: 130 },
      { name: 'pointOfContact', size: 190 },
      { name: 'company', size: 220 },
      { name: 'owner', size: 170 },
      { name: 'amount', size: 150 },
      { name: 'closeDate', size: 170 },
      { name: 'stage', size: 150 },
    ];

    for (let i = 0; i < tableColumns.length; i++) {
      const col = tableColumns[i];
      const fId = fMap[col.name];
      if (fId) {
        await c.query(`
          INSERT INTO core."viewField" (
            id, "universalIdentifier", "viewId", "fieldMetadataId",
            position, "isVisible", size, "workspaceId", "applicationId",
            "createdAt", "updatedAt"
          ) VALUES (
            gen_random_uuid(), gen_random_uuid(), $1, $2,
            $3, true, $4, $5, $6,
            NOW(), NOW()
          )
        `, [tableViewId, fId, i, col.size, wsId, stdAppId]);
      }
    }
    console.log('  ✓ Configured table columns in All Deals view');
  }

  // 11. Configure "Deal Pipeline" KANBAN View
  console.log('📌 Configuring "Deal Pipeline" Kanban View...');
  const stageFieldId = fMap['stage'];
  const kanbanRes = await c.query(`
    SELECT id FROM core.view 
    WHERE "workspaceId" = $1 AND "objectMetadataId" = $2 AND type = 'KANBAN' AND name ILIKE '%Deal%'
  `, [wsId, oppObjId]);

  if (kanbanRes.rows.length > 0 && stageFieldId) {
    const kanbanId = kanbanRes.rows[0].id;
    await c.query(`
      UPDATE core.view 
      SET name = 'Deal Pipeline', icon = 'IconProgressCheck', "mainGroupByFieldMetadataId" = $1
      WHERE id = $2
    `, [stageFieldId, kanbanId]);

    await c.query(`DELETE FROM core."viewGroup" WHERE "viewId" = $1`, [kanbanId]);

    const kanbanStages = ['NEW', 'NEGOTIATION', 'SITE_VISIT', 'DOCUMENTATION', 'CLOSED_WON', 'CLOSED_LOST'];
    for (let k = 0; k < kanbanStages.length; k++) {
      await c.query(`
        INSERT INTO core."viewGroup" (
          id, "universalIdentifier", "viewId", "fieldValue",
          "isVisible", position, "workspaceId", "applicationId",
          "createdAt", "updatedAt"
        ) VALUES (
          gen_random_uuid(), gen_random_uuid(), $1, $2,
          true, $3, $4, $5,
          NOW(), NOW()
        )
      `, [kanbanId, kanbanStages[k], k, wsId, stdAppId]);
    }
    console.log('  ✓ Configured 6 stage columns in Deal Pipeline Kanban');
  }

  // 12. Invalidate Metadata Cache
  await c.query(`UPDATE core.workspace SET "metadataVersion" = "metadataVersion" + 1 WHERE id = $1`, [wsId]);
  console.log('✨ Workspace metadata cache version incremented');

  await c.end();
  console.log('\n✅ Deals module provisioning successfully completed!');
}

provisionDealsFields().catch(err => {
  console.error('❌ Provisioning Error:', err);
  process.exit(1);
});
