const { Client } = require('pg');

async function provisionBuyersLeadsFields() {
  const c = new Client({
    connectionString: process.env.PG_DATABASE_URL || 'postgres://postgres:postgres@db:5432/default',
  });
  await c.connect();

  console.log('🚀 Starting Real Estate Buyers & Leads Field Provisioning...');

  const wsRes = await c.query(`SELECT id, "displayName", "databaseSchema" FROM core.workspace WHERE "deletedAt" IS NULL`);
  if (wsRes.rows.length === 0) {
    throw new Error('No active workspace found');
  }

  for (const ws of wsRes.rows) {
    const wsId = ws.id;
    const dbSchema = ws.databaseSchema;
    console.log(`\n🏢 Processing Workspace: "${ws.displayName}" (${wsId}) [Schema: ${dbSchema}]`);

    // Fetch Application ID
    const appRes = await c.query(`
      SELECT id FROM core.application 
      WHERE "workspaceId" = $1 
      ORDER BY "createdAt" ASC LIMIT 1
    `, [wsId]);
    const appId = appRes.rows[0].id;

    // Fetch Object Metadata ID for person (Buyers & Leads)
    const personObjRes = await c.query(`
      SELECT id FROM core."objectMetadata" 
      WHERE "workspaceId" = $1 AND "nameSingular" = 'person'
    `, [wsId]);
    if (personObjRes.rows.length === 0) {
      console.warn('Person object not found in workspace, skipping');
      continue;
    }
    const personObjId = personObjRes.rows[0].id;

    // Fetch Object Metadata ID for workspaceMember (Agents & Brokers)
    const memberObjRes = await c.query(`
      SELECT id FROM core."objectMetadata" 
      WHERE "workspaceId" = $1 AND "nameSingular" = 'workspaceMember'
    `, [wsId]);
    const memberObjId = memberObjRes.rows.length > 0 ? memberObjRes.rows[0].id : null;

    // Fetch active member ID for assignedAgent default
    let defaultMemberId = null;
    if (dbSchema) {
      const memRes = await c.query(`SELECT id FROM ${dbSchema}."workspaceMember" LIMIT 1`).catch(() => ({ rows: [] }));
      if (memRes.rows.length > 0) {
        defaultMemberId = memRes.rows[0].id;
      }
    }

    // 1. Update Existing Standard Fields to Real Estate terminology
    console.log('✏️  Updating existing standard fields on person...');
    await c.query(`UPDATE core."fieldMetadata" SET label = 'Full Name', icon = 'IconUser', description = 'Full name of the prospective buyer or lead' WHERE "objectMetadataId" = $1 AND name = 'name'`, [personObjId]);
    await c.query(`UPDATE core."fieldMetadata" SET label = 'Phone', icon = 'IconPhone', description = 'Primary contact phone number of the buyer' WHERE "objectMetadataId" = $1 AND name = 'phones'`, [personObjId]);
    await c.query(`UPDATE core."fieldMetadata" SET label = 'Email', icon = 'IconMail', description = 'Primary contact email address of the buyer' WHERE "objectMetadataId" = $1 AND name = 'emails'`, [personObjId]);

    // 2. Define Custom Fields for Buyers & Leads
    const fieldsToCreate = [
      {
        name: 'leadId',
        label: 'Lead ID',
        type: 'TEXT',
        icon: 'IconHash',
        description: 'Auto-generated unique buyer or lead identification code (e.g. LEAD-101)',
        options: null,
      },
      {
        name: 'leadSource',
        label: 'Lead Source',
        type: 'SELECT',
        icon: 'IconTarget',
        description: 'Select: Website, Referral, Ads, Walk-in, Other',
        options: [
          { id: '80808080-0001-4000-8000-000000000001', color: 'blue', label: 'Website', value: 'WEBSITE', position: 0 },
          { id: '80808080-0002-4000-8000-000000000002', color: 'green', label: 'Referral', value: 'REFERRAL', position: 1 },
          { id: '80808080-0003-4000-8000-000000000003', color: 'purple', label: 'Ads', value: 'ADS', position: 2 },
          { id: '80808080-0004-4000-8000-000000000004', color: 'orange', label: 'Walk-in', value: 'WALK_IN', position: 3 },
          { id: '80808080-0005-4000-8000-000000000005', color: 'gray', label: 'Other', value: 'OTHER', position: 4 },
        ],
      },
      {
        name: 'requirement',
        label: 'Requirement',
        type: 'SELECT',
        icon: 'IconBuildingSkyscraper',
        description: 'Select: Buy / Rent',
        options: [
          { id: '80808080-0011-4000-8000-000000000001', color: 'teal', label: 'Buy', value: 'BUY', position: 0 },
          { id: '80808080-0012-4000-8000-000000000002', color: 'blue', label: 'Rent', value: 'RENT', position: 1 },
        ],
      },
      {
        name: 'preferredPropertyType',
        label: 'Preferred Property Type',
        type: 'SELECT',
        icon: 'IconHome',
        description: 'Desired property type: Apartment, House, Villa, Plot, Commercial',
        options: [
          { id: '80808080-0021-4000-8000-000000000001', color: 'blue', label: 'Apartment', value: 'APARTMENT', position: 0 },
          { id: '80808080-0022-4000-8000-000000000002', color: 'yellow', label: 'House', value: 'HOUSE', position: 1 },
          { id: '80808080-0023-4000-8000-000000000003', color: 'green', label: 'Villa', value: 'VILLA', position: 2 },
          { id: '80808080-0024-4000-8000-000000000004', color: 'orange', label: 'Plot', value: 'PLOT', position: 3 },
          { id: '80808080-0025-4000-8000-000000000005', color: 'purple', label: 'Commercial', value: 'COMMERCIAL', position: 4 },
        ],
      },
      {
        name: 'budgetMin',
        label: 'Budget Min',
        type: 'CURRENCY',
        icon: 'IconCurrencyDollar',
        description: 'Minimum acquisition or rental budget',
        options: null,
      },
      {
        name: 'budgetMax',
        label: 'Budget Max',
        type: 'CURRENCY',
        icon: 'IconCurrencyDollar',
        description: 'Maximum acquisition or rental budget ceiling',
        options: null,
      },
      {
        name: 'preferredLocation',
        label: 'Preferred Location',
        type: 'TEXT',
        icon: 'IconMapPin',
        description: 'Preferred neighborhood, area, or city location',
        options: null,
      },
      {
        name: 'assignedAgent',
        label: 'Assigned Agent',
        type: 'RELATION',
        icon: 'IconUserCheck',
        description: 'The real estate agent or broker handling this buyer / lead',
        options: null,
        relationTargetObjectMetadataId: memberObjId,
        settings: {
          onDelete: 'SET_NULL',
          relationType: 'MANY_TO_ONE',
          joinColumnName: 'assignedAgentId'
        }
      },
      {
        name: 'leadStage',
        label: 'Lead Stage',
        type: 'SELECT',
        icon: 'IconProgressCheck',
        description: 'Select / Pipeline: New, Contacted, Qualified, Negotiation, Closed Won, Closed Lost',
        options: [
          { id: '80808080-0031-4000-8000-000000000001', color: 'sky', label: 'New', value: 'NEW', position: 0 },
          { id: '80808080-0032-4000-8000-000000000002', color: 'blue', label: 'Contacted', value: 'CONTACTED', position: 1 },
          { id: '80808080-0033-4000-8000-000000000003', color: 'yellow', label: 'Qualified', value: 'QUALIFIED', position: 2 },
          { id: '80808080-0034-4000-8000-000000000004', color: 'orange', label: 'Negotiation', value: 'NEGOTIATION', position: 3 },
          { id: '80808080-0035-4000-8000-000000000005', color: 'green', label: 'Closed Won', value: 'CLOSED_WON', position: 4 },
          { id: '80808080-0036-4000-8000-000000000006', color: 'red', label: 'Closed Lost', value: 'CLOSED_LOST', position: 5 },
        ],
      },
    ];

    console.log('➕ Registering custom fields in core."fieldMetadata"...');
    for (const f of fieldsToCreate) {
      const existingField = await c.query(`
        SELECT id FROM core."fieldMetadata" 
        WHERE "objectMetadataId" = $1 AND name = $2
      `, [personObjId, f.name]);

      if (existingField.rows.length === 0) {
        await c.query(`
          INSERT INTO core."fieldMetadata" (
            id, "universalIdentifier", "objectMetadataId", "workspaceId", "applicationId",
            name, label, type, icon, description, options, "isActive", "isSystem",
            "isUIEditable", "isUIReadOnly", "isNullable", "isLabelSyncedWithName",
            "relationTargetObjectMetadataId", settings, "createdAt", "updatedAt"
          ) VALUES (
            gen_random_uuid(), gen_random_uuid(), $1, $2, $3,
            $4, $5, $6, $7, $8, $9, true, false,
            true, false, true, false,
            $10, $11, NOW(), NOW()
          )
        `, [
          personObjId, wsId, appId,
          f.name, f.label, f.type, f.icon, f.description,
          f.options ? JSON.stringify(f.options) : null,
          f.relationTargetObjectMetadataId || null,
          f.settings ? JSON.stringify(f.settings) : null,
        ]);
        console.log(`  ✓ Created fieldMetadata: ${f.name} (${f.label}) [${f.type}]`);
      } else {
        await c.query(`
          UPDATE core."fieldMetadata"
          SET label = $1, icon = $2, description = $3, options = $4, "relationTargetObjectMetadataId" = $5, settings = $6, "updatedAt" = NOW()
          WHERE id = $7
        `, [
          f.label, f.icon, f.description,
          f.options ? JSON.stringify(f.options) : null,
          f.relationTargetObjectMetadataId || null,
          f.settings ? JSON.stringify(f.settings) : null,
          existingField.rows[0].id
        ]);
        console.log(`  ↻ Updated fieldMetadata: ${f.name} (${f.label})`);
      }
    }

    // 3. PostgreSQL Enums and Table Columns in Database Schema
    if (dbSchema) {
      console.log('🐘 Creating PostgreSQL Enums and Columns in schema:', dbSchema);

      await c.query(`
        DO $$
        BEGIN
          IF NOT EXISTS (SELECT 1 FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace WHERE t.typname = 'person_leadSource_enum' AND n.nspname = '${dbSchema}') THEN
            CREATE TYPE ${dbSchema}."person_leadSource_enum" AS ENUM ('WEBSITE', 'REFERRAL', 'ADS', 'WALK_IN', 'OTHER');
          END IF;
          IF NOT EXISTS (SELECT 1 FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace WHERE t.typname = 'person_requirement_enum' AND n.nspname = '${dbSchema}') THEN
            CREATE TYPE ${dbSchema}."person_requirement_enum" AS ENUM ('BUY', 'RENT');
          END IF;
          IF NOT EXISTS (SELECT 1 FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace WHERE t.typname = 'person_preferredPropertyType_enum' AND n.nspname = '${dbSchema}') THEN
            CREATE TYPE ${dbSchema}."person_preferredPropertyType_enum" AS ENUM ('APARTMENT', 'HOUSE', 'VILLA', 'PLOT', 'COMMERCIAL');
          END IF;
          IF NOT EXISTS (SELECT 1 FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace WHERE t.typname = 'person_leadStage_enum' AND n.nspname = '${dbSchema}') THEN
            CREATE TYPE ${dbSchema}."person_leadStage_enum" AS ENUM ('NEW', 'CONTACTED', 'QUALIFIED', 'NEGOTIATION', 'CLOSED_WON', 'CLOSED_LOST');
          END IF;
        END $$;
      `);

      // Auto-generated sequence for Lead ID
      await c.query(`
        CREATE SEQUENCE IF NOT EXISTS ${dbSchema}.person_lead_id_seq START WITH 109;
      `);

      // Add columns to person table
      await c.query(`
        ALTER TABLE ${dbSchema}.person ADD COLUMN IF NOT EXISTS "leadId" text;
        ALTER TABLE ${dbSchema}.person ADD COLUMN IF NOT EXISTS "leadSource" ${dbSchema}."person_leadSource_enum";
        ALTER TABLE ${dbSchema}.person ADD COLUMN IF NOT EXISTS "requirement" ${dbSchema}."person_requirement_enum";
        ALTER TABLE ${dbSchema}.person ADD COLUMN IF NOT EXISTS "preferredPropertyType" ${dbSchema}."person_preferredPropertyType_enum";
        ALTER TABLE ${dbSchema}.person ADD COLUMN IF NOT EXISTS "budgetMinAmountMicros" numeric;
        ALTER TABLE ${dbSchema}.person ADD COLUMN IF NOT EXISTS "budgetMinCurrencyCode" text DEFAULT 'USD';
        ALTER TABLE ${dbSchema}.person ADD COLUMN IF NOT EXISTS "budgetMaxAmountMicros" numeric;
        ALTER TABLE ${dbSchema}.person ADD COLUMN IF NOT EXISTS "budgetMaxCurrencyCode" text DEFAULT 'USD';
        ALTER TABLE ${dbSchema}.person ADD COLUMN IF NOT EXISTS "preferredLocation" text;
        ALTER TABLE ${dbSchema}.person ADD COLUMN IF NOT EXISTS "assignedAgentId" uuid;
        ALTER TABLE ${dbSchema}.person ADD COLUMN IF NOT EXISTS "leadStage" ${dbSchema}."person_leadStage_enum";
      `);
      console.log('  ✓ Physical columns added or confirmed in person table');

      // Populate rich mock data for existing 8 leads
      console.log('📊 Updating existing Leads with comprehensive real estate data...');
      const sampleLeads = [
        {
          id: '44444444-0001-4000-8000-000000000001',
          leadId: 'LEAD-101',
          leadSource: 'ADS',
          requirement: 'BUY',
          preferredPropertyType: 'VILLA',
          budgetMin: 2000000000000, // $2.0M
          budgetMax: 2500000000000, // $2.5M
          preferredLocation: 'San Francisco, CA',
          leadStage: 'QUALIFIED',
        },
        {
          id: '44444444-0002-4000-8000-000000000002',
          leadId: 'LEAD-102',
          leadSource: 'WEBSITE',
          requirement: 'BUY',
          preferredPropertyType: 'VILLA',
          budgetMin: 1400000000000, // $1.4M
          budgetMax: 1700000000000, // $1.7M
          preferredLocation: 'Austin, TX',
          leadStage: 'NEGOTIATION',
        },
        {
          id: '44444444-0003-4000-8000-000000000003',
          leadId: 'LEAD-103',
          leadSource: 'REFERRAL',
          requirement: 'RENT',
          preferredPropertyType: 'COMMERCIAL',
          budgetMin: 8000000000, // $8,000/mo
          budgetMax: 12000000000, // $12,000/mo
          preferredLocation: 'New York, NY',
          leadStage: 'CONTACTED',
        },
        {
          id: '44444444-0004-4000-8000-000000000004',
          leadId: 'LEAD-104',
          leadSource: 'WALK_IN',
          requirement: 'RENT',
          preferredPropertyType: 'APARTMENT',
          budgetMin: 4000000000, // $4,000/mo
          budgetMax: 5500000000, // $5,500/mo
          preferredLocation: 'Miami, FL',
          leadStage: 'NEW',
        },
        {
          id: '44444444-0005-4000-8000-000000000005',
          leadId: 'LEAD-105',
          leadSource: 'WEBSITE',
          requirement: 'BUY',
          preferredPropertyType: 'VILLA',
          budgetMin: 2800000000000, // $2.8M
          budgetMax: 3500000000000, // $3.5M
          preferredLocation: 'San Diego, CA',
          leadStage: 'CLOSED_WON',
        },
        {
          id: '44444444-0006-4000-8000-000000000006',
          leadId: 'LEAD-106',
          leadSource: 'ADS',
          requirement: 'BUY',
          preferredPropertyType: 'APARTMENT',
          budgetMin: 700000000000, // $700K
          budgetMax: 850000000000, // $850K
          preferredLocation: 'Seattle, WA',
          leadStage: 'QUALIFIED',
        },
        {
          id: '44444444-0007-4000-8000-000000000007',
          leadId: 'LEAD-107',
          leadSource: 'REFERRAL',
          requirement: 'BUY',
          preferredPropertyType: 'COMMERCIAL',
          budgetMin: 1500000000000, // $1.5M
          budgetMax: 2000000000000, // $2.0M
          preferredLocation: 'San Jose, CA',
          leadStage: 'NEGOTIATION',
        },
        {
          id: '44444444-0008-4000-8000-000000000008',
          leadId: 'LEAD-108',
          leadSource: 'WEBSITE',
          requirement: 'BUY',
          preferredPropertyType: 'PLOT',
          budgetMin: 400000000000, // $400K
          budgetMax: 500000000000, // $500K
          preferredLocation: 'Denver, CO',
          leadStage: 'NEW',
        },
      ];

      for (const lead of sampleLeads) {
        await c.query(`
          UPDATE ${dbSchema}.person
          SET 
            "leadId" = $1,
            "leadSource" = $2::${dbSchema}."person_leadSource_enum",
            "requirement" = $3::${dbSchema}."person_requirement_enum",
            "preferredPropertyType" = $4::${dbSchema}."person_preferredPropertyType_enum",
            "budgetMinAmountMicros" = $5,
            "budgetMinCurrencyCode" = 'USD',
            "budgetMaxAmountMicros" = $6,
            "budgetMaxCurrencyCode" = 'USD',
            "preferredLocation" = $7,
            "leadStage" = $8::${dbSchema}."person_leadStage_enum",
            "assignedAgentId" = $9
          WHERE id = $10
        `, [
          lead.leadId,
          lead.leadSource,
          lead.requirement,
          lead.preferredPropertyType,
          lead.budgetMin,
          lead.budgetMax,
          lead.preferredLocation,
          lead.leadStage,
          defaultMemberId,
          lead.id
        ]);
      }
      console.log('  ✓ Updated 8 existing leads with real estate attributes');
    }

    // 4. Configure View Fields for "All Buyers & Leads" Table View
    console.log('👁️  Configuring View Fields for "All Buyers & Leads"...');
    const viewRes = await c.query(`
      SELECT id FROM core."view" 
      WHERE "workspaceId" = $1 AND "objectMetadataId" = $2 AND "key" = 'INDEX'
    `, [wsId, personObjId]);

    if (viewRes.rows.length > 0) {
      const viewId = viewRes.rows[0].id;
      
      // Update view title and icon
      await c.query(`
        UPDATE core."view" 
        SET name = 'All Buyers & Leads', icon = 'IconUserCheck' 
        WHERE id = $1
      `, [viewId]);

      // Remove old view fields
      await c.query(`DELETE FROM core."viewField" WHERE "viewId" = $1`, [viewId]);

      // Fetch all field IDs for person
      const allFieldsRes = await c.query(`
        SELECT id, name FROM core."fieldMetadata" 
        WHERE "objectMetadataId" = $1
      `, [personObjId]);
      const fieldMap = {};
      allFieldsRes.rows.forEach(r => { fieldMap[r.name] = r.id; });

      // Desired column order:
      // 1. Lead ID
      // 2. Full Name
      // 3. Phone
      // 4. Email
      // 5. Lead Source
      // 6. Requirement
      // 7. Preferred Property Type
      // 8. Budget Min
      // 9. Budget Max
      // 10. Preferred Location
      // 11. Lead Stage
      // 12. Assigned Agent
      const viewColumns = [
        { name: 'leadId', size: 120 },
        { name: 'name', size: 180 },
        { name: 'phones', size: 150 },
        { name: 'emails', size: 210 },
        { name: 'leadSource', size: 130 },
        { name: 'requirement', size: 120 },
        { name: 'preferredPropertyType', size: 170 },
        { name: 'budgetMin', size: 130 },
        { name: 'budgetMax', size: 130 },
        { name: 'preferredLocation', size: 160 },
        { name: 'leadStage', size: 140 },
        { name: 'assignedAgent', size: 160 },
      ];

      for (let i = 0; i < viewColumns.length; i++) {
        const col = viewColumns[i];
        const fId = fieldMap[col.name];
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
          `, [viewId, fId, i, col.size, wsId, appId]);
        }
      }
      console.log('  ✓ Configured table columns in All Buyers & Leads view');
    }

    // 5. Configure "Lead Pipeline" KANBAN View on person
    console.log('📌 Configuring "Lead Pipeline" Kanban View...');
    const leadStageFieldRes = await c.query(`
      SELECT id FROM core."fieldMetadata" 
      WHERE "objectMetadataId" = $1 AND name = 'leadStage'
    `, [personObjId]);

    if (leadStageFieldRes.rows.length > 0) {
      const leadStageFieldId = leadStageFieldRes.rows[0].id;

      let kanbanViewRes = await c.query(`
        SELECT id FROM core."view" 
        WHERE "objectMetadataId" = $1 AND type = 'KANBAN'
      `, [personObjId]);

      let kanbanViewId;
      if (kanbanViewRes.rows.length === 0) {
        const newKanban = await c.query(`
          INSERT INTO core."view" (
            id, "universalIdentifier", name, type, "objectMetadataId",
            "workspaceId", "applicationId", position, icon, "mainGroupByFieldMetadataId",
            visibility, "openRecordIn", "isActive", "groupLoadLimit",
            "createdAt", "updatedAt"
          ) VALUES (
            gen_random_uuid(), gen_random_uuid(), 'Lead Pipeline', 'KANBAN', $1,
            $2, $3, 1, 'IconProgressCheck', $4,
            'WORKSPACE', 'SIDE_PANEL', true, 8,
            NOW(), NOW()
          ) RETURNING id
        `, [personObjId, wsId, appId, leadStageFieldId]);
        kanbanViewId = newKanban.rows[0].id;
      } else {
        kanbanViewId = kanbanViewRes.rows[0].id;
        await c.query(`
          UPDATE core."view" 
          SET name = 'Lead Pipeline', icon = 'IconProgressCheck', "mainGroupByFieldMetadataId" = $1
          WHERE id = $2
        `, [leadStageFieldId, kanbanViewId]);
      }

      // Configure Kanban View Groups for Lead Stages
      await c.query(`DELETE FROM core."viewGroup" WHERE "viewId" = $1`, [kanbanViewId]);
      const leadStages = ['NEW', 'CONTACTED', 'QUALIFIED', 'NEGOTIATION', 'CLOSED_WON', 'CLOSED_LOST'];
      for (let sIdx = 0; sIdx < leadStages.length; sIdx++) {
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
        `, [kanbanViewId, leadStages[sIdx], sIdx, wsId, appId]);
      }
      console.log('  ✓ Configured Kanban Pipeline columns for Lead Stages');
    }

    // 6. Invalidate Workspace Metadata Cache
    await c.query(`UPDATE core.workspace SET "metadataVersion" = "metadataVersion" + 1 WHERE id = $1`, [wsId]);
    console.log('✨ Workspace metadata cache bumped.');
  }

  await c.end();
  console.log('\n✅ Real Estate Buyers & Leads Field Provisioning Complete!');
}

provisionBuyersLeadsFields().catch(err => {
  console.error('❌ Provisioning Error:', err);
  process.exit(1);
});
