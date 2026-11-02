const { Client } = require('pg');

async function provisionAgentFields() {
  const c = new Client({
    connectionString: process.env.PG_DATABASE_URL || 'postgres://postgres:postgres@db:5432/default',
  });
  await c.connect();

  console.log('🚀 Starting Real Estate Agents Module Field Provisioning...');

  const wsId = '32c2a902-9983-4e13-b6f6-bc96609f8238';
  const wsRes = await c.query(`SELECT id, "displayName", "databaseSchema" FROM core.workspace WHERE id = $1`, [wsId]);
  if (wsRes.rows.length === 0) {
    throw new Error('Real estate workspace not found');
  }

  const ws = wsRes.rows[0];
  const dbSchema = ws.databaseSchema;
  console.log(`\n🏢 Workspace: "${ws.displayName}" (${wsId}) [Schema: ${dbSchema}]`);

  // Fetch Application ID
  const appRes = await c.query(`
    SELECT id FROM core.application 
    WHERE "workspaceId" = $1 AND name = 'Custom'
    ORDER BY "createdAt" ASC LIMIT 1
  `, [wsId]);
  const appId = appRes.rows[0].id;

  // Fetch Object Metadata ID for workspaceMember (Agents)
  const memberObjRes = await c.query(`
    SELECT id FROM core."objectMetadata" 
    WHERE "workspaceId" = $1 AND "nameSingular" = 'workspaceMember'
  `, [wsId]);
  if (memberObjRes.rows.length === 0) {
    throw new Error('workspaceMember object metadata not found');
  }
  const memberObjId = memberObjRes.rows[0].id;

  // Update object metadata labels to "Agent" / "Agents"
  await c.query(`
    UPDATE core."objectMetadata"
    SET "labelSingular" = 'Agent',
        "labelPlural" = 'Agents',
        "isUICreatable" = true,
        "isUIEditable" = true,
        "isUIReadOnly" = false
    WHERE id = $1
  `, [memberObjId]);

  // Update Navigation menu item to "Agents"
  await c.query(`
    UPDATE core."navigationMenuItem"
    SET "name" = 'Agents'
    WHERE "workspaceId" = $1 AND "targetObjectMetadataId" = $2;
  `, [wsId, memberObjId]);

  // 1. Update Existing Standard Fields
  console.log('✏️  Updating existing standard fields on Agents...');
  await c.query(`
    UPDATE core."fieldMetadata" 
    SET label = 'Agent Name', icon = 'IconUser', description = 'Full name of the real estate agent or broker', "isUIEditable" = true
    WHERE "objectMetadataId" = $1 AND name = 'name'
  `, [memberObjId]);

  await c.query(`
    UPDATE core."fieldMetadata" 
    SET label = 'Email', icon = 'IconMail', description = 'Professional email address of the agent', "isUIEditable" = true
    WHERE "objectMetadataId" = $1 AND name = 'userEmail'
  `, [memberObjId]);

  await c.query(`
    UPDATE core."fieldMetadata" 
    SET label = 'Assigned Properties', icon = 'IconHome', description = 'Properties assigned to and managed by this agent', "isUIEditable" = true
    WHERE "objectMetadataId" = $1 AND name = 'accountOwnerForCompanies'
  `, [memberObjId]);

  await c.query(`
    UPDATE core."fieldMetadata" 
    SET label = 'Deals', icon = 'IconCurrencyDollar', description = 'Deals and sales transactions handled by this agent', "isUIEditable" = true
    WHERE "objectMetadataId" = $1 AND name = 'ownedOpportunities'
  `, [memberObjId]);

  // 2. Define Custom Fields for Agents
  const fieldsToCreate = [
    {
      name: 'agentId',
      label: 'Agent ID',
      type: 'TEXT',
      icon: 'IconId',
      description: 'Auto-generated unique Agent ID (e.g. AGT-101)',
      options: null,
      settings: null,
    },
    {
      name: 'phoneNumber',
      label: 'Phone Number',
      type: 'PHONES',
      icon: 'IconPhone',
      description: 'Primary contact phone number of the agent',
      options: null,
      settings: { maxNumberOfValues: 1 },
    },
    {
      name: 'licenseNumber',
      label: 'License Number',
      type: 'TEXT',
      icon: 'IconCertificate',
      description: 'Real estate license or accreditation number (e.g. CA-DRE-01984211)',
      options: null,
      settings: null,
    },
    {
      name: 'experienceYears',
      label: 'Experience (Years)',
      type: 'NUMBER',
      icon: 'IconAward',
      description: 'Total years of professional real estate experience',
      options: null,
      settings: { decimals: 0 },
    },
    {
      name: 'specialization',
      label: 'Specialization',
      type: 'SELECT',
      icon: 'IconBuilding',
      description: 'Select: Residential, Commercial, Land, Rental',
      options: [
        { id: '80808080-0041-4000-8000-000000000001', color: 'blue', label: 'Residential', value: 'RESIDENTIAL', position: 0 },
        { id: '80808080-0042-4000-8000-000000000002', color: 'purple', label: 'Commercial', value: 'COMMERCIAL', position: 1 },
        { id: '80808080-0043-4000-8000-000000000003', color: 'green', label: 'Land', value: 'LAND', position: 2 },
        { id: '80808080-0044-4000-8000-000000000004', color: 'orange', label: 'Rental', value: 'RENTAL', position: 3 },
      ],
      settings: null,
    },
    {
      name: 'location',
      label: 'Location',
      type: 'TEXT',
      icon: 'IconMapPin',
      description: 'Operating market or territory location (e.g. San Francisco, CA)',
      options: null,
      settings: null,
    },
    {
      name: 'status',
      label: 'Status',
      type: 'SELECT',
      icon: 'IconActivity',
      description: 'Select: Active, Inactive',
      options: [
        { id: '80808080-0051-4000-8000-000000000001', color: 'green', label: 'Active', value: 'ACTIVE', position: 0 },
        { id: '80808080-0052-4000-8000-000000000002', color: 'gray', label: 'Inactive', value: 'INACTIVE', position: 1 },
      ],
      settings: null,
    },
    {
      name: 'joiningDate',
      label: 'Joining Date',
      type: 'DATE',
      icon: 'IconCalendar',
      description: 'Date the agent joined the real estate agency',
      options: null,
      settings: null,
    },
    {
      name: 'commissionRate',
      label: 'Commission Rate (%)',
      type: 'NUMBER',
      icon: 'IconPercentage',
      description: 'Agent commission percentage rate (e.g. 2.5%)',
      options: null,
      settings: { decimals: 2 },
    },
  ];

  console.log('➕ Registering custom fields in core."fieldMetadata"...');
  for (const f of fieldsToCreate) {
    const existing = await c.query(`
      SELECT id FROM core."fieldMetadata" 
      WHERE "objectMetadataId" = $1 AND name = $2
    `, [memberObjId, f.name]);

    if (existing.rows.length === 0) {
      await c.query(`
        INSERT INTO core."fieldMetadata" (
          id, "universalIdentifier", "objectMetadataId", "workspaceId", "applicationId",
          name, label, type, icon, description, options, settings, "isActive", "isSystem",
          "isUIEditable", "isUIReadOnly", "isNullable", "isLabelSyncedWithName",
          "writability", "isAuditLogged", "createdAt", "updatedAt"
        ) VALUES (
          gen_random_uuid(), gen_random_uuid(), $1, $2, $3,
          $4, $5, $6, $7, $8, $9, $10, true, false,
          true, false, true, false,
          'OPEN', true, NOW(), NOW()
        )
      `, [
        memberObjId, wsId, appId,
        f.name, f.label, f.type, f.icon, f.description,
        f.options ? JSON.stringify(f.options) : null,
        f.settings ? JSON.stringify(f.settings) : null,
      ]);
      console.log(`  ✓ Created fieldMetadata: ${f.name} (${f.label}) [${f.type}]`);
    } else {
      await c.query(`
        UPDATE core."fieldMetadata"
        SET label = $1, icon = $2, description = $3, options = $4, settings = $5,
            "isUIEditable" = true, "isUIReadOnly" = false, "writability" = 'OPEN', "updatedAt" = NOW()
        WHERE id = $6
      `, [
        f.label, f.icon, f.description,
        f.options ? JSON.stringify(f.options) : null,
        f.settings ? JSON.stringify(f.settings) : null,
        existing.rows[0].id,
      ]);
      console.log(`  ↻ Updated fieldMetadata: ${f.name} (${f.label})`);
    }
  }

  // 3. PostgreSQL Enums and Table Columns in Database Schema
  console.log('🐘 Creating PostgreSQL Enums and Columns in schema:', dbSchema);
  await c.query(`
    DO $$
    BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace WHERE t.typname = 'workspaceMember_specialization_enum' AND n.nspname = '${dbSchema}') THEN
        CREATE TYPE ${dbSchema}."workspaceMember_specialization_enum" AS ENUM ('RESIDENTIAL', 'COMMERCIAL', 'LAND', 'RENTAL');
      END IF;
      IF NOT EXISTS (SELECT 1 FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace WHERE t.typname = 'workspaceMember_status_enum' AND n.nspname = '${dbSchema}') THEN
        CREATE TYPE ${dbSchema}."workspaceMember_status_enum" AS ENUM ('ACTIVE', 'INACTIVE');
      END IF;
    END $$;
  `);

  // Sequence for auto-generating Agent ID
  await c.query(`
    CREATE SEQUENCE IF NOT EXISTS ${dbSchema}.agent_id_seq START WITH 107;
  `);

  // Physical columns on workspaceMember
  await c.query(`
    ALTER TABLE ${dbSchema}."workspaceMember" ADD COLUMN IF NOT EXISTS "agentId" text;
    ALTER TABLE ${dbSchema}."workspaceMember" ADD COLUMN IF NOT EXISTS "phoneNumberPrimaryPhoneNumber" text;
    ALTER TABLE ${dbSchema}."workspaceMember" ADD COLUMN IF NOT EXISTS "phoneNumberPrimaryPhoneCountryCode" text DEFAULT 'US';
    ALTER TABLE ${dbSchema}."workspaceMember" ADD COLUMN IF NOT EXISTS "phoneNumberPrimaryPhoneCallingCode" text DEFAULT '+1';
    ALTER TABLE ${dbSchema}."workspaceMember" ADD COLUMN IF NOT EXISTS "phoneNumberAdditionalPhones" jsonb;
    ALTER TABLE ${dbSchema}."workspaceMember" ADD COLUMN IF NOT EXISTS "phoneNumber" text;
    ALTER TABLE ${dbSchema}."workspaceMember" ADD COLUMN IF NOT EXISTS "licenseNumber" text;
    ALTER TABLE ${dbSchema}."workspaceMember" ADD COLUMN IF NOT EXISTS "experienceYears" double precision;
    ALTER TABLE ${dbSchema}."workspaceMember" ADD COLUMN IF NOT EXISTS "specialization" ${dbSchema}."workspaceMember_specialization_enum";
    ALTER TABLE ${dbSchema}."workspaceMember" ADD COLUMN IF NOT EXISTS "location" text;
    ALTER TABLE ${dbSchema}."workspaceMember" ADD COLUMN IF NOT EXISTS "status" ${dbSchema}."workspaceMember_status_enum" DEFAULT 'ACTIVE';
    ALTER TABLE ${dbSchema}."workspaceMember" ADD COLUMN IF NOT EXISTS "joiningDate" date;
    ALTER TABLE ${dbSchema}."workspaceMember" ADD COLUMN IF NOT EXISTS "commissionRate" double precision;
  `);
  console.log('  ✓ Physical columns added to workspaceMember table');

  // 4. Update the BEFORE INSERT trigger to auto-populate agentId, status, and sync user
  console.log('⚡ Updating sync trigger to auto-assign Agent ID & Status...');
  await c.query(`
    CREATE OR REPLACE FUNCTION ${dbSchema}.sync_agent_user_workspace()
    RETURNS TRIGGER AS $$
    DECLARE
      v_user_id uuid;
      v_email text;
      v_first_name text;
      v_last_name text;
      v_existing_user_id uuid;
      v_ws_id uuid := '32c2a902-9983-4e13-b6f6-bc96609f8238';
    BEGIN
      -- Auto-generate Agent ID if not set
      IF NEW."agentId" IS NULL OR NEW."agentId" = '' THEN
        NEW."agentId" := 'AGT-' || nextval('${dbSchema}.agent_id_seq');
      END IF;

      -- Default status to ACTIVE
      IF NEW."status" IS NULL THEN
        NEW."status" := 'ACTIVE';
      END IF;

      v_first_name := COALESCE(NEW."nameFirstName", 'Agent');
      v_last_name := COALESCE(NEW."nameLastName", '');

      IF NEW."userEmail" IS NOT NULL AND NEW."userEmail" <> '' THEN
        v_email := LOWER(TRIM(NEW."userEmail"));
        SELECT id INTO v_existing_user_id FROM core."user" WHERE LOWER(email::text) = v_email AND "deletedAt" IS NULL LIMIT 1;
        IF v_existing_user_id IS NOT NULL THEN
          v_user_id := v_existing_user_id;
        END IF;
      END IF;

      IF v_user_id IS NULL THEN
        IF NEW."userId" IS NOT NULL THEN
          v_user_id := NEW."userId";
        ELSE
          v_user_id := gen_random_uuid();
        END IF;
        IF v_email IS NULL OR v_email = '' THEN
          v_email := 'agent.' || v_user_id || '@twentyestates.com';
        END IF;

        INSERT INTO core."user" (id, email, "firstName", "lastName", "createdAt", "updatedAt", "isEmailVerified")
        VALUES (v_user_id, v_email, v_first_name, v_last_name, NOW(), NOW(), true)
        ON CONFLICT (id) DO UPDATE 
          SET "firstName" = EXCLUDED."firstName",
              "lastName" = EXCLUDED."lastName";
      END IF;

      NEW."userId" := v_user_id;

      -- Ensure userWorkspace exists in core."userWorkspace"
      IF NOT EXISTS (
        SELECT 1 FROM core."userWorkspace" 
        WHERE "userId" = v_user_id AND "workspaceId" = v_ws_id AND "deletedAt" IS NULL
      ) THEN
        INSERT INTO core."userWorkspace" (id, "userId", "workspaceId", "createdAt", "updatedAt")
        VALUES (gen_random_uuid(), v_user_id, v_ws_id, NOW(), NOW());
      END IF;

      RETURN NEW;
    END;
    $$ LANGUAGE plpgsql;
  `);

  // 5. Populate Sample Data for Existing Agents
  console.log('📊 Updating existing agents with comprehensive real estate data...');
  const agentData = [
    {
      id: 'f0aced67-0fbe-4335-9bf2-292d4e7696c9', // ilakkiya s
      agentId: 'AGT-101',
      phone: '4155550100',
      licenseNumber: 'CA-DRE-01984211',
      experienceYears: 12,
      specialization: 'COMMERCIAL',
      location: 'San Francisco, CA',
      status: 'ACTIVE',
      joiningDate: '2020-01-15',
      commissionRate: 2.50,
    },
    {
      id: '88888888-1001-4000-8000-000000000001', // Marcus Vance
      agentId: 'AGT-102',
      phone: '4155550101',
      licenseNumber: 'CA-DRE-02048932',
      experienceYears: 8,
      specialization: 'COMMERCIAL',
      location: 'Los Angeles, CA',
      status: 'ACTIVE',
      joiningDate: '2021-03-01',
      commissionRate: 2.75,
    },
    {
      id: '88888888-1002-4000-8000-000000000002', // Elena Rostova
      agentId: 'AGT-103',
      phone: '4155550102',
      licenseNumber: 'NY-DOS-4928103',
      experienceYears: 6,
      specialization: 'RESIDENTIAL',
      location: 'New York, NY',
      status: 'ACTIVE',
      joiningDate: '2021-08-15',
      commissionRate: 3.00,
    },
    {
      id: '88888888-1003-4000-8000-000000000003', // Carlos Morales
      agentId: 'AGT-104',
      phone: '4155550103',
      licenseNumber: 'TX-TREC-0639201',
      experienceYears: 5,
      specialization: 'LAND',
      location: 'Austin, TX',
      status: 'ACTIVE',
      joiningDate: '2022-05-10',
      commissionRate: 2.50,
    },
    {
      id: '88888888-1004-4000-8000-000000000004', // Sarah Jenkins
      agentId: 'AGT-105',
      phone: '4155550104',
      licenseNumber: 'FL-DBPR-3891045',
      experienceYears: 4,
      specialization: 'RENTAL',
      location: 'Miami, FL',
      status: 'ACTIVE',
      joiningDate: '2023-01-20',
      commissionRate: 2.00,
    },
    {
      id: 'cdb44bb1-b831-4641-952d-eedd1a739e66', // Jessica Taylor
      agentId: 'AGT-106',
      phone: '4155550105',
      licenseNumber: 'WA-DOL-0912384',
      experienceYears: 7,
      specialization: 'RESIDENTIAL',
      location: 'Seattle, WA',
      status: 'ACTIVE',
      joiningDate: '2022-11-01',
      commissionRate: 2.80,
    },
  ];

  for (const ag of agentData) {
    await c.query(`
      UPDATE ${dbSchema}."workspaceMember"
      SET 
        "agentId" = $1,
        "phoneNumberPrimaryPhoneNumber" = $2,
        "phoneNumberPrimaryPhoneCountryCode" = 'US',
        "phoneNumberPrimaryPhoneCallingCode" = '+1',
        "licenseNumber" = $3,
        "experienceYears" = $4,
        "specialization" = $5::${dbSchema}."workspaceMember_specialization_enum",
        "location" = $6,
        "status" = $7::${dbSchema}."workspaceMember_status_enum",
        "joiningDate" = $8,
        "commissionRate" = $9
      WHERE id = $10
    `, [
      ag.agentId,
      ag.phone,
      ag.licenseNumber,
      ag.experienceYears,
      ag.specialization,
      ag.location,
      ag.status,
      ag.joiningDate,
      ag.commissionRate,
      ag.id,
    ]);
  }
  console.log('  ✓ Updated all existing agents with real estate profile attributes');

  // 6. Configure "All Agents" Table View Fields
  console.log('👁️  Configuring View Fields for "All Agents"...');
  const viewRes = await c.query(`
    SELECT id FROM core."view" 
    WHERE "workspaceId" = $1 AND "objectMetadataId" = $2 AND "key" = 'INDEX'
  `, [wsId, memberObjId]);

  if (viewRes.rows.length > 0) {
    const viewId = viewRes.rows[0].id;
    await c.query(`
      UPDATE core."view" 
      SET name = 'All Agents', icon = 'IconUserCheck' 
      WHERE id = $1
    `, [viewId]);

    // Clear existing view fields
    await c.query(`DELETE FROM core."viewField" WHERE "viewId" = $1`, [viewId]);

    // Fetch all field IDs for workspaceMember
    const allFieldsRes = await c.query(`
      SELECT id, name FROM core."fieldMetadata" 
      WHERE "objectMetadataId" = $1
    `, [memberObjId]);
    const fieldMap = {};
    allFieldsRes.rows.forEach(r => { fieldMap[r.name] = r.id; });

    // Desired column order:
    // 1. Agent Name
    // 2. Agent ID
    // 3. Email
    // 4. Phone Number
    // 5. License Number
    // 6. Experience (Years)
    // 7. Specialization
    // 8. Location
    // 9. Status
    // 10. Joining Date
    // 11. Commission Rate (%)
    // 12. Assigned Properties
    // 13. Deals
    const viewColumns = [
      { name: 'name', size: 180 },
      { name: 'agentId', size: 110 },
      { name: 'userEmail', size: 220 },
      { name: 'phoneNumber', size: 160 },
      { name: 'licenseNumber', size: 140 },
      { name: 'experienceYears', size: 130 },
      { name: 'specialization', size: 140 },
      { name: 'location', size: 150 },
      { name: 'status', size: 110 },
      { name: 'joiningDate', size: 120 },
      { name: 'commissionRate', size: 140 },
      { name: 'accountOwnerForCompanies', size: 170 },
      { name: 'ownedOpportunities', size: 130 },
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
    console.log('  ✓ Configured table columns in All Agents view');
  }

  // 7. Bump metadataVersion to trigger UI cache reload
  console.log('🔄 Bumping workspace metadataVersion...');
  await c.query(`
    UPDATE core.workspace 
    SET "metadataVersion" = "metadataVersion" + 1 
    WHERE id = $1
  `, [wsId]);

  console.log('🎉 Agents module fields provisioning completed successfully!');
  await c.end();
}

provisionAgentFields().catch(console.error);

