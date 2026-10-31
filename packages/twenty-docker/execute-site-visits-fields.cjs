const { Client } = require('pg');

async function provisionSiteVisitsFields() {
  const c = new Client({
    connectionString: process.env.PG_DATABASE_URL || 'postgres://postgres:postgres@db:5432/default',
  });
  await c.connect();

  const wsId = '32c2a902-9983-4e13-b6f6-bc96609f8238';
  const schema = 'workspace_306npwj88jcxnl7zwdogk8bw8';

  console.log('🚀 Starting Site Visits Module Field Provisioning for Real Estate CRM...');

  // 1. Applications
  const stdAppRes = await c.query(`SELECT id FROM core.application WHERE "workspaceId" = $1 AND name = 'Standard' LIMIT 1`, [wsId]);
  const customAppRes = await c.query(`SELECT id FROM core.application WHERE "workspaceId" = $1 AND name = 'Custom' LIMIT 1`, [wsId]);
  const stdAppId = stdAppRes.rows.length > 0 ? stdAppRes.rows[0].id : null;
  const customAppId = customAppRes.rows.length > 0 ? customAppRes.rows[0].id : stdAppId;

  // 2. Objects
  const noteObj = (await c.query(`SELECT id FROM core."objectMetadata" WHERE "workspaceId" = $1 AND "nameSingular" = 'note'`, [wsId])).rows[0];
  const personObj = (await c.query(`SELECT id FROM core."objectMetadata" WHERE "workspaceId" = $1 AND "nameSingular" = 'person'`, [wsId])).rows[0];
  const companyObj = (await c.query(`SELECT id FROM core."objectMetadata" WHERE "workspaceId" = $1 AND "nameSingular" = 'company'`, [wsId])).rows[0];
  const memberObj = (await c.query(`SELECT id FROM core."objectMetadata" WHERE "workspaceId" = $1 AND "nameSingular" = 'workspaceMember'`, [wsId])).rows[0];

  const noteObjId = noteObj.id;
  const personObjId = personObj.id;
  const companyObjId = companyObj.id;
  const memberObjId = memberObj.id;

  console.log('  ✓ Note Object ID:', noteObjId);
  console.log('  ✓ Person (Buyers & Leads) Object ID:', personObjId);
  console.log('  ✓ Company (Property Listings) Object ID:', companyObjId);
  console.log('  ✓ WorkspaceMember (Agents) Object ID:', memberObjId);

  // 3. PostgreSQL Enums, Sequence, and Columns on schema.note
  console.log('\n📦 Setting up PostgreSQL Enums, Sequences, and Columns...');
  
  await c.query(`
    DO $$ BEGIN
      CREATE TYPE ${schema}."note_visitStatus_enum" AS ENUM ('SCHEDULED', 'COMPLETED', 'CANCELLED', 'NO_SHOW');
    EXCEPTION WHEN duplicate_object THEN null;
    END $$;
  `);

  await c.query(`CREATE SEQUENCE IF NOT EXISTS ${schema}.note_visit_id_seq START WITH 109;`);

  await c.query(`
    ALTER TABLE ${schema}.note
      ADD COLUMN IF NOT EXISTS "visitId" text,
      ADD COLUMN IF NOT EXISTS "buyerLeadId" uuid,
      ADD COLUMN IF NOT EXISTS "propertyId" uuid,
      ADD COLUMN IF NOT EXISTS "visitDate" date,
      ADD COLUMN IF NOT EXISTS "visitTime" text,
      ADD COLUMN IF NOT EXISTS "assignedAgentId" uuid,
      ADD COLUMN IF NOT EXISTS "visitStatus" ${schema}."note_visitStatus_enum" DEFAULT 'SCHEDULED',
      ADD COLUMN IF NOT EXISTS "feedback" text,
      ADD COLUMN IF NOT EXISTS "nextActionDate" date;
  `);
  console.log('  ✓ Table columns and types created successfully');

  // 4. Reverse Relations on Person, Company, and WorkspaceMember
  console.log('\n🔗 Setting up Relations...');

  // 4.1 Reverse relation on Person (person.siteVisits)
  let personVisitsRes = await c.query(`SELECT id FROM core."fieldMetadata" WHERE "workspaceId" = $1 AND "objectMetadataId" = $2 AND name = 'siteVisits'`, [wsId, personObjId]);
  let personVisitsFieldId;
  if (personVisitsRes.rows.length === 0) {
    const ins = await c.query(`
      INSERT INTO core."fieldMetadata" (
        id, "universalIdentifier", "objectMetadataId", "workspaceId", "applicationId",
        name, label, type, icon, description, settings, "isActive", "isSystem",
        "isUIEditable", "isUIReadOnly", "isNullable", "isLabelSyncedWithName",
        "relationTargetObjectMetadataId", "createdAt", "updatedAt"
      ) VALUES (
        gen_random_uuid(), gen_random_uuid(), $1, $2, $3,
        'siteVisits', 'Site Visits', 'RELATION', 'IconCalendarEvent', 'Site visits scheduled for this buyer or lead',
        '{"relationType": "ONE_TO_MANY"}'::jsonb, true, false,
        false, false, false, false,
        $4, NOW(), NOW()
      ) RETURNING id;
    `, [personObjId, wsId, customAppId, noteObjId]);
    personVisitsFieldId = ins.rows[0].id;
  } else {
    personVisitsFieldId = personVisitsRes.rows[0].id;
  }

  // 4.2 Reverse relation on Company (company.siteVisits)
  let companyVisitsRes = await c.query(`SELECT id FROM core."fieldMetadata" WHERE "workspaceId" = $1 AND "objectMetadataId" = $2 AND name = 'siteVisits'`, [wsId, companyObjId]);
  let companyVisitsFieldId;
  if (companyVisitsRes.rows.length === 0) {
    const ins = await c.query(`
      INSERT INTO core."fieldMetadata" (
        id, "universalIdentifier", "objectMetadataId", "workspaceId", "applicationId",
        name, label, type, icon, description, settings, "isActive", "isSystem",
        "isUIEditable", "isUIReadOnly", "isNullable", "isLabelSyncedWithName",
        "relationTargetObjectMetadataId", "createdAt", "updatedAt"
      ) VALUES (
        gen_random_uuid(), gen_random_uuid(), $1, $2, $3,
        'siteVisits', 'Site Visits', 'RELATION', 'IconCalendarEvent', 'Site visits scheduled for this property listing',
        '{"relationType": "ONE_TO_MANY"}'::jsonb, true, false,
        false, false, false, false,
        $4, NOW(), NOW()
      ) RETURNING id;
    `, [companyObjId, wsId, customAppId, noteObjId]);
    companyVisitsFieldId = ins.rows[0].id;
  } else {
    companyVisitsFieldId = companyVisitsRes.rows[0].id;
  }

  // 4.3 Reverse relation on WorkspaceMember (workspaceMember.assignedSiteVisits)
  let memberVisitsRes = await c.query(`SELECT id FROM core."fieldMetadata" WHERE "workspaceId" = $1 AND "objectMetadataId" = $2 AND name = 'assignedSiteVisits'`, [wsId, memberObjId]);
  let memberVisitsFieldId;
  if (memberVisitsRes.rows.length === 0) {
    const ins = await c.query(`
      INSERT INTO core."fieldMetadata" (
        id, "universalIdentifier", "objectMetadataId", "workspaceId", "applicationId",
        name, label, type, icon, description, settings, "isActive", "isSystem",
        "isUIEditable", "isUIReadOnly", "isNullable", "isLabelSyncedWithName",
        "relationTargetObjectMetadataId", "createdAt", "updatedAt"
      ) VALUES (
        gen_random_uuid(), gen_random_uuid(), $1, $2, $3,
        'assignedSiteVisits', 'Assigned Site Visits', 'RELATION', 'IconCalendarEvent', 'Site visits assigned to this agent',
        '{"relationType": "ONE_TO_MANY"}'::jsonb, true, false,
        false, false, false, false,
        $4, NOW(), NOW()
      ) RETURNING id;
    `, [memberObjId, wsId, customAppId, noteObjId]);
    memberVisitsFieldId = ins.rows[0].id;
  } else {
    memberVisitsFieldId = memberVisitsRes.rows[0].id;
  }

  // 5. Fields on Note in core."fieldMetadata"
  console.log('\n📝 Ensuring all 9 Site Visit fields on note...');

  // 5.1 Visit ID (TEXT)
  let visitIdFieldRes = await c.query(`SELECT id FROM core."fieldMetadata" WHERE "workspaceId" = $1 AND "objectMetadataId" = $2 AND name = 'visitId'`, [wsId, noteObjId]);
  let visitIdFieldId;
  if (visitIdFieldRes.rows.length === 0) {
    const ins = await c.query(`
      INSERT INTO core."fieldMetadata" (
        id, "universalIdentifier", "objectMetadataId", "workspaceId", "applicationId",
        name, label, type, icon, description, settings, "isActive", "isSystem",
        "isUIEditable", "isUIReadOnly", "isNullable", "isLabelSyncedWithName", "createdAt", "updatedAt"
      ) VALUES (
        gen_random_uuid(), gen_random_uuid(), $1, $2, $3,
        'visitId', 'Visit ID', 'TEXT', 'IconId', 'Auto-generated unique visit identifier (e.g. VISIT-101)',
        null, true, false,
        true, false, true, false, NOW(), NOW()
      ) RETURNING id;
    `, [noteObjId, wsId, customAppId]);
    visitIdFieldId = ins.rows[0].id;
  } else {
    visitIdFieldId = visitIdFieldRes.rows[0].id;
    await c.query(`UPDATE core."fieldMetadata" SET label = 'Visit ID', icon = 'IconId', "updatedAt" = NOW() WHERE id = $1`, [visitIdFieldId]);
  }
  console.log('  ✓ visitId Field ID:', visitIdFieldId);

  // 5.2 Buyer / Lead (RELATION -> Person)
  let buyerLeadFieldRes = await c.query(`SELECT id FROM core."fieldMetadata" WHERE "workspaceId" = $1 AND "objectMetadataId" = $2 AND name = 'buyerLead'`, [wsId, noteObjId]);
  let buyerLeadFieldId;
  if (buyerLeadFieldRes.rows.length === 0) {
    const ins = await c.query(`
      INSERT INTO core."fieldMetadata" (
        id, "universalIdentifier", "objectMetadataId", "workspaceId", "applicationId",
        name, label, type, icon, description, settings, "isActive", "isSystem",
        "isUIEditable", "isUIReadOnly", "isNullable", "isLabelSyncedWithName",
        "relationTargetObjectMetadataId", "relationTargetFieldMetadataId", "createdAt", "updatedAt"
      ) VALUES (
        gen_random_uuid(), gen_random_uuid(), $1, $2, $3,
        'buyerLead', 'Buyer / Lead', 'RELATION', 'IconUser', 'Prospective buyer or lead scheduled for property visit',
        '{"relationType": "MANY_TO_ONE", "joinColumnName": "buyerLeadId"}'::jsonb, true, false,
        true, false, true, false,
        $4, $5, NOW(), NOW()
      ) RETURNING id;
    `, [noteObjId, wsId, customAppId, personObjId, personVisitsFieldId]);
    buyerLeadFieldId = ins.rows[0].id;
  } else {
    buyerLeadFieldId = buyerLeadFieldRes.rows[0].id;
    await c.query(`
      UPDATE core."fieldMetadata" 
      SET label = 'Buyer / Lead', icon = 'IconUser', "relationTargetObjectMetadataId" = $1, "relationTargetFieldMetadataId" = $2, "updatedAt" = NOW()
      WHERE id = $3
    `, [personObjId, personVisitsFieldId, buyerLeadFieldId]);
  }
  await c.query(`UPDATE core."fieldMetadata" SET "relationTargetFieldMetadataId" = $1 WHERE id = $2`, [buyerLeadFieldId, personVisitsFieldId]);
  console.log('  ✓ buyerLead Field ID:', buyerLeadFieldId);

  // 5.3 Property (RELATION -> Company)
  let propertyFieldRes = await c.query(`SELECT id FROM core."fieldMetadata" WHERE "workspaceId" = $1 AND "objectMetadataId" = $2 AND name = 'property'`, [wsId, noteObjId]);
  let propertyFieldId;
  if (propertyFieldRes.rows.length === 0) {
    const ins = await c.query(`
      INSERT INTO core."fieldMetadata" (
        id, "universalIdentifier", "objectMetadataId", "workspaceId", "applicationId",
        name, label, type, icon, description, settings, "isActive", "isSystem",
        "isUIEditable", "isUIReadOnly", "isNullable", "isLabelSyncedWithName",
        "relationTargetObjectMetadataId", "relationTargetFieldMetadataId", "createdAt", "updatedAt"
      ) VALUES (
        gen_random_uuid(), gen_random_uuid(), $1, $2, $3,
        'property', 'Property', 'RELATION', 'IconBuildingSkyscraper', 'Property listing to be visited',
        '{"relationType": "MANY_TO_ONE", "joinColumnName": "propertyId"}'::jsonb, true, false,
        true, false, true, false,
        $4, $5, NOW(), NOW()
      ) RETURNING id;
    `, [noteObjId, wsId, customAppId, companyObjId, companyVisitsFieldId]);
    propertyFieldId = ins.rows[0].id;
  } else {
    propertyFieldId = propertyFieldRes.rows[0].id;
    await c.query(`
      UPDATE core."fieldMetadata" 
      SET label = 'Property', icon = 'IconBuildingSkyscraper', "relationTargetObjectMetadataId" = $1, "relationTargetFieldMetadataId" = $2, "updatedAt" = NOW()
      WHERE id = $3
    `, [companyObjId, companyVisitsFieldId, propertyFieldId]);
  }
  await c.query(`UPDATE core."fieldMetadata" SET "relationTargetFieldMetadataId" = $1 WHERE id = $2`, [propertyFieldId, companyVisitsFieldId]);
  console.log('  ✓ property Field ID:', propertyFieldId);

  // 5.4 Visit Date (DATE)
  let visitDateFieldRes = await c.query(`SELECT id FROM core."fieldMetadata" WHERE "workspaceId" = $1 AND "objectMetadataId" = $2 AND name = 'visitDate'`, [wsId, noteObjId]);
  let visitDateFieldId;
  if (visitDateFieldRes.rows.length === 0) {
    const ins = await c.query(`
      INSERT INTO core."fieldMetadata" (
        id, "universalIdentifier", "objectMetadataId", "workspaceId", "applicationId",
        name, label, type, icon, description, settings, "isActive", "isSystem",
        "isUIEditable", "isUIReadOnly", "isNullable", "isLabelSyncedWithName", "createdAt", "updatedAt"
      ) VALUES (
        gen_random_uuid(), gen_random_uuid(), $1, $2, $3,
        'visitDate', 'Visit Date', 'DATE', 'IconCalendar', 'Scheduled date of the site visit',
        null, true, false,
        true, false, true, false, NOW(), NOW()
      ) RETURNING id;
    `, [noteObjId, wsId, customAppId]);
    visitDateFieldId = ins.rows[0].id;
  } else {
    visitDateFieldId = visitDateFieldRes.rows[0].id;
    await c.query(`UPDATE core."fieldMetadata" SET label = 'Visit Date', icon = 'IconCalendar', "updatedAt" = NOW() WHERE id = $1`, [visitDateFieldId]);
  }
  console.log('  ✓ visitDate Field ID:', visitDateFieldId);

  // 5.5 Visit Time (TEXT)
  let visitTimeFieldRes = await c.query(`SELECT id FROM core."fieldMetadata" WHERE "workspaceId" = $1 AND "objectMetadataId" = $2 AND name = 'visitTime'`, [wsId, noteObjId]);
  let visitTimeFieldId;
  if (visitTimeFieldRes.rows.length === 0) {
    const ins = await c.query(`
      INSERT INTO core."fieldMetadata" (
        id, "universalIdentifier", "objectMetadataId", "workspaceId", "applicationId",
        name, label, type, icon, description, settings, "isActive", "isSystem",
        "isUIEditable", "isUIReadOnly", "isNullable", "isLabelSyncedWithName", "createdAt", "updatedAt"
      ) VALUES (
        gen_random_uuid(), gen_random_uuid(), $1, $2, $3,
        'visitTime', 'Visit Time', 'TEXT', 'IconClock', 'Scheduled time of the site visit (e.g. 10:30 AM)',
        null, true, false,
        true, false, true, false, NOW(), NOW()
      ) RETURNING id;
    `, [noteObjId, wsId, customAppId]);
    visitTimeFieldId = ins.rows[0].id;
  } else {
    visitTimeFieldId = visitTimeFieldRes.rows[0].id;
    await c.query(`UPDATE core."fieldMetadata" SET label = 'Visit Time', icon = 'IconClock', "updatedAt" = NOW() WHERE id = $1`, [visitTimeFieldId]);
  }
  console.log('  ✓ visitTime Field ID:', visitTimeFieldId);

  // 5.6 Assigned Agent (RELATION -> WorkspaceMember)
  let agentFieldRes = await c.query(`SELECT id FROM core."fieldMetadata" WHERE "workspaceId" = $1 AND "objectMetadataId" = $2 AND name = 'assignedAgent'`, [wsId, noteObjId]);
  let agentFieldId;
  if (agentFieldRes.rows.length === 0) {
    const ins = await c.query(`
      INSERT INTO core."fieldMetadata" (
        id, "universalIdentifier", "objectMetadataId", "workspaceId", "applicationId",
        name, label, type, icon, description, settings, "isActive", "isSystem",
        "isUIEditable", "isUIReadOnly", "isNullable", "isLabelSyncedWithName",
        "relationTargetObjectMetadataId", "relationTargetFieldMetadataId", "createdAt", "updatedAt"
      ) VALUES (
        gen_random_uuid(), gen_random_uuid(), $1, $2, $3,
        'assignedAgent', 'Assigned Agent', 'RELATION', 'IconUserCheck', 'Real estate agent assigned to conduct the site visit',
        '{"relationType": "MANY_TO_ONE", "joinColumnName": "assignedAgentId"}'::jsonb, true, false,
        true, false, true, false,
        $4, $5, NOW(), NOW()
      ) RETURNING id;
    `, [noteObjId, wsId, customAppId, memberObjId, memberVisitsFieldId]);
    agentFieldId = ins.rows[0].id;
  } else {
    agentFieldId = agentFieldRes.rows[0].id;
    await c.query(`
      UPDATE core."fieldMetadata" 
      SET label = 'Assigned Agent', icon = 'IconUserCheck', "relationTargetObjectMetadataId" = $1, "relationTargetFieldMetadataId" = $2, "updatedAt" = NOW()
      WHERE id = $3
    `, [memberObjId, memberVisitsFieldId, agentFieldId]);
  }
  await c.query(`UPDATE core."fieldMetadata" SET "relationTargetFieldMetadataId" = $1 WHERE id = $2`, [agentFieldId, memberVisitsFieldId]);
  console.log('  ✓ assignedAgent Field ID:', agentFieldId);

  // 5.7 Visit Status (SELECT: Scheduled, Completed, Cancelled, No-show)
  const visitStatusOptions = [
    { id: '60606060-0001-4000-8000-000000000001', color: 'sky', label: 'Scheduled', value: 'SCHEDULED', position: 0 },
    { id: '60606060-0002-4000-8000-000000000002', color: 'green', label: 'Completed', value: 'COMPLETED', position: 1 },
    { id: '60606060-0003-4000-8000-000000000003', color: 'red', label: 'Cancelled', value: 'CANCELLED', position: 2 },
    { id: '60606060-0004-4000-8000-000000000004', color: 'orange', label: 'No-show', value: 'NO_SHOW', position: 3 },
  ];

  let visitStatusFieldRes = await c.query(`SELECT id FROM core."fieldMetadata" WHERE "workspaceId" = $1 AND "objectMetadataId" = $2 AND name = 'visitStatus'`, [wsId, noteObjId]);
  let visitStatusFieldId;
  if (visitStatusFieldRes.rows.length === 0) {
    const ins = await c.query(`
      INSERT INTO core."fieldMetadata" (
        id, "universalIdentifier", "objectMetadataId", "workspaceId", "applicationId",
        name, label, type, icon, description, options, "defaultValue", settings,
        "isActive", "isSystem", "isUIEditable", "isUIReadOnly", "isNullable", "isLabelSyncedWithName", "createdAt", "updatedAt"
      ) VALUES (
        gen_random_uuid(), gen_random_uuid(), $1, $2, $3,
        'visitStatus', 'Visit Status', 'SELECT', 'IconProgressCheck', 'Select: Scheduled / Completed / Cancelled / No-show',
        $4, $5, null,
        true, false, true, false, false, false, NOW(), NOW()
      ) RETURNING id;
    `, [noteObjId, wsId, customAppId, JSON.stringify(visitStatusOptions), JSON.stringify("'SCHEDULED'")]);
    visitStatusFieldId = ins.rows[0].id;
  } else {
    visitStatusFieldId = visitStatusFieldRes.rows[0].id;
    await c.query(`
      UPDATE core."fieldMetadata" 
      SET label = 'Visit Status', icon = 'IconProgressCheck', options = $1, "defaultValue" = $2, "updatedAt" = NOW()
      WHERE id = $3
    `, [JSON.stringify(visitStatusOptions), JSON.stringify("'SCHEDULED'"), visitStatusFieldId]);
  }
  console.log('  ✓ visitStatus Field ID:', visitStatusFieldId);

  // 5.8 Feedback (TEXT)
  let feedbackFieldRes = await c.query(`SELECT id FROM core."fieldMetadata" WHERE "workspaceId" = $1 AND "objectMetadataId" = $2 AND name = 'feedback'`, [wsId, noteObjId]);
  let feedbackFieldId;
  if (feedbackFieldRes.rows.length === 0) {
    const ins = await c.query(`
      INSERT INTO core."fieldMetadata" (
        id, "universalIdentifier", "objectMetadataId", "workspaceId", "applicationId",
        name, label, type, icon, description, settings, "isActive", "isSystem",
        "isUIEditable", "isUIReadOnly", "isNullable", "isLabelSyncedWithName", "createdAt", "updatedAt"
      ) VALUES (
        gen_random_uuid(), gen_random_uuid(), $1, $2, $3,
        'feedback', 'Feedback', 'TEXT', 'IconMessageDots', 'Buyer feedback, notes, and visit observations',
        null, true, false,
        true, false, true, false, NOW(), NOW()
      ) RETURNING id;
    `, [noteObjId, wsId, customAppId]);
    feedbackFieldId = ins.rows[0].id;
  } else {
    feedbackFieldId = feedbackFieldRes.rows[0].id;
    await c.query(`UPDATE core."fieldMetadata" SET label = 'Feedback', icon = 'IconMessageDots', "updatedAt" = NOW() WHERE id = $1`, [feedbackFieldId]);
  }
  console.log('  ✓ feedback Field ID:', feedbackFieldId);

  // 5.9 Next Action Date (DATE)
  let nextActionDateFieldRes = await c.query(`SELECT id FROM core."fieldMetadata" WHERE "workspaceId" = $1 AND "objectMetadataId" = $2 AND name = 'nextActionDate'`, [wsId, noteObjId]);
  let nextActionDateFieldId;
  if (nextActionDateFieldRes.rows.length === 0) {
    const ins = await c.query(`
      INSERT INTO core."fieldMetadata" (
        id, "universalIdentifier", "objectMetadataId", "workspaceId", "applicationId",
        name, label, type, icon, description, settings, "isActive", "isSystem",
        "isUIEditable", "isUIReadOnly", "isNullable", "isLabelSyncedWithName", "createdAt", "updatedAt"
      ) VALUES (
        gen_random_uuid(), gen_random_uuid(), $1, $2, $3,
        'nextActionDate', 'Next Action Date', 'DATE', 'IconCalendarDue', 'Follow-up or next action date after the site visit',
        null, true, false,
        true, false, true, false, NOW(), NOW()
      ) RETURNING id;
    `, [noteObjId, wsId, customAppId]);
    nextActionDateFieldId = ins.rows[0].id;
  } else {
    nextActionDateFieldId = nextActionDateFieldRes.rows[0].id;
    await c.query(`UPDATE core."fieldMetadata" SET label = 'Next Action Date', icon = 'IconCalendarDue', "updatedAt" = NOW() WHERE id = $1`, [nextActionDateFieldId]);
  }
  console.log('  ✓ nextActionDate Field ID:', nextActionDateFieldId);

  // 6. Set labelIdentifierFieldMetadataId to visitId
  await c.query(`UPDATE core."objectMetadata" SET "labelIdentifierFieldMetadataId" = $1 WHERE id = $2`, [visitIdFieldId, noteObjId]);
  console.log('  ✓ Updated note labelIdentifierFieldMetadataId to visitId');

  // 7. Auto-assignment & Sync Triggers
  console.log('\n⚙️  Setting up Database Triggers on note...');
  await c.query(`
    CREATE OR REPLACE FUNCTION ${schema}.note_site_visit_trigger()
    RETURNS TRIGGER AS $$
    BEGIN
      IF NEW."visitId" IS NULL OR NEW."visitId" = '' THEN
        NEW."visitId" := 'VISIT-' || nextval('${schema}.note_visit_id_seq');
      END IF;
      IF NEW.title IS NULL OR NEW.title = '' THEN
        NEW.title := NEW."visitId" || ' (' || COALESCE(NEW."visitStatus"::text, 'SCHEDULED') || ')';
      END IF;
      RETURN NEW;
    END;
    $$ LANGUAGE plpgsql;

    DROP TRIGGER IF EXISTS trg_note_site_visit_before ON ${schema}.note;
    CREATE TRIGGER trg_note_site_visit_before
    BEFORE INSERT ON ${schema}.note
    FOR EACH ROW EXECUTE FUNCTION ${schema}.note_site_visit_trigger();

    CREATE OR REPLACE FUNCTION ${schema}.note_sync_targets()
    RETURNS TRIGGER AS $$
    BEGIN
      IF NEW."buyerLeadId" IS NOT NULL OR NEW."propertyId" IS NOT NULL THEN
        IF EXISTS (SELECT 1 FROM ${schema}."noteTarget" WHERE "noteId" = NEW.id) THEN
          UPDATE ${schema}."noteTarget"
          SET "targetPersonId" = COALESCE(NEW."buyerLeadId", "targetPersonId"),
              "targetCompanyId" = COALESCE(NEW."propertyId", "targetCompanyId"),
              "updatedAt" = NOW()
          WHERE "noteId" = NEW.id;
        ELSE
          INSERT INTO ${schema}."noteTarget" (
            id, "universalIdentifier", "noteId", "targetPersonId", "targetCompanyId",
            "createdAt", "updatedAt"
          ) VALUES (
            gen_random_uuid(), gen_random_uuid(), NEW.id, NEW."buyerLeadId", NEW."propertyId",
            NOW(), NOW()
          );
        END IF;
      END IF;
      RETURN NEW;
    END;
    $$ LANGUAGE plpgsql;

    DROP TRIGGER IF EXISTS trg_note_sync_targets ON ${schema}.note;
    CREATE TRIGGER trg_note_sync_targets
    AFTER INSERT OR UPDATE OF "buyerLeadId", "propertyId" ON ${schema}.note
    FOR EACH ROW EXECUTE FUNCTION ${schema}.note_sync_targets();
  `);
  console.log('  ✓ Database triggers installed');

  // 8. Clean up empty notes and populate the 8 site visit records
  console.log('\n🧹 Cleaning up empty notes & populating realistic site visit records...');
  await c.query(`DELETE FROM ${schema}.note WHERE title IS NULL AND "bodyV2Markdown" IS NULL;`);

  const visitSeedData = [
    {
      id: '55555555-0001-4000-8000-000000000001',
      visitId: 'VISIT-101',
      buyerLeadId: '44444444-0001-4000-8000-000000000001',
      propertyId: '33333333-0001-4000-8000-000000000001',
      visitDate: '2026-10-30',
      visitTime: '10:30 AM',
      assignedAgentId: '88888888-1001-4000-8000-000000000001',
      visitStatus: 'SCHEDULED',
      feedback: 'Private sunset terrace tour and private elevator key inspection.',
      nextActionDate: '2026-11-01',
      title: 'VISIT-101 (Scheduled)',
    },
    {
      id: '55555555-0002-4000-8000-000000000002',
      visitId: 'VISIT-102',
      buyerLeadId: '44444444-0002-4000-8000-000000000002',
      propertyId: '33333333-0002-4000-8000-000000000002',
      visitDate: '2026-10-28',
      visitTime: '02:00 PM',
      assignedAgentId: '88888888-1002-4000-8000-000000000002',
      visitStatus: 'COMPLETED',
      feedback: 'Buyer loved the landscaped courtyard and modern European kitchen. Preparing purchase offer at $1.62M.',
      nextActionDate: '2026-10-29',
      title: 'VISIT-102 (Completed)',
    },
    {
      id: '55555555-0003-4000-8000-000000000003',
      visitId: 'VISIT-103',
      buyerLeadId: '44444444-0003-4000-8000-000000000003',
      propertyId: '33333333-0004-4000-8000-000000000004',
      visitDate: '2026-10-29',
      visitTime: '11:00 AM',
      assignedAgentId: '88888888-1001-4000-8000-000000000001',
      visitStatus: 'SCHEDULED',
      feedback: 'Inspection for 45 tech workstations and server room cooling capacity.',
      nextActionDate: '2026-11-03',
      title: 'VISIT-103 (Scheduled)',
    },
    {
      id: '55555555-0004-4000-8000-000000000004',
      visitId: 'VISIT-104',
      buyerLeadId: '44444444-0004-4000-8000-000000000004',
      propertyId: '33333333-0003-4000-8000-000000000003',
      visitDate: '2026-10-27',
      visitTime: '04:30 PM',
      assignedAgentId: '88888888-1003-4000-8000-000000000003',
      visitStatus: 'COMPLETED',
      feedback: 'Verified unobstructed ocean view and allocated EV parking stalls. Submitted annual rental application.',
      nextActionDate: '2026-10-29',
      title: 'VISIT-104 (Completed)',
    },
    {
      id: '55555555-0005-4000-8000-000000000005',
      visitId: 'VISIT-105',
      buyerLeadId: '44444444-0005-4000-8000-000000000005',
      propertyId: '33333333-0005-4000-8000-000000000005',
      visitDate: '2026-10-25',
      visitTime: '01:00 PM',
      assignedAgentId: '88888888-1001-4000-8000-000000000001',
      visitStatus: 'COMPLETED',
      feedback: 'Comprehensive structural and boat dock inspection passed with buyer architect. Offer of $3.15M accepted!',
      nextActionDate: '2026-10-28',
      title: 'VISIT-105 (Completed)',
    },
    {
      id: '55555555-0006-4000-8000-000000000006',
      visitId: 'VISIT-106',
      buyerLeadId: '44444444-0006-4000-8000-000000000006',
      propertyId: '33333333-0006-4000-8000-000000000006',
      visitDate: '2026-11-02',
      visitTime: '03:00 PM',
      assignedAgentId: '88888888-1002-4000-8000-000000000002',
      visitStatus: 'SCHEDULED',
      feedback: 'First-time home buyer visit with family. Requested floor plan measurements and HOA bylaws.',
      nextActionDate: '2026-11-04',
      title: 'VISIT-106 (Scheduled)',
    },
    {
      id: '55555555-0007-4000-8000-000000000007',
      visitId: 'VISIT-107',
      buyerLeadId: '44444444-0007-4000-8000-000000000007',
      propertyId: '33333333-0007-4000-8000-000000000007',
      visitDate: '2026-10-24',
      visitTime: '10:00 AM',
      assignedAgentId: '88888888-1003-4000-8000-000000000003',
      visitStatus: 'COMPLETED',
      feedback: 'Commercial zoning and high-speed dedicated fiber connection verified. Buyer moving to negotiation stage.',
      nextActionDate: '2026-10-30',
      title: 'VISIT-107 (Completed)',
    },
    {
      id: '55555555-0008-4000-8000-000000000008',
      visitId: 'VISIT-108',
      buyerLeadId: '44444444-0008-4000-8000-000000000008',
      propertyId: '33333333-0008-4000-8000-000000000008',
      visitDate: '2026-10-31',
      visitTime: '11:30 AM',
      assignedAgentId: '88888888-1002-4000-8000-000000000002',
      visitStatus: 'SCHEDULED',
      feedback: 'Soil test geotechnical report and boundary topographical survey to be provided during visit.',
      nextActionDate: '2026-11-02',
      title: 'VISIT-108 (Scheduled)',
    },
  ];

  for (const v of visitSeedData) {
    await c.query(`
      UPDATE ${schema}.note
      SET "visitId" = $1,
          "buyerLeadId" = $2,
          "propertyId" = $3,
          "visitDate" = $4::date,
          "visitTime" = $5,
          "assignedAgentId" = $6,
          "visitStatus" = $7::${schema}."note_visitStatus_enum",
          "feedback" = $8,
          "nextActionDate" = $9::date,
          title = $10
      WHERE id = $11
    `, [v.visitId, v.buyerLeadId, v.propertyId, v.visitDate, v.visitTime, v.assignedAgentId, v.visitStatus, v.feedback, v.nextActionDate, v.title, v.id]);
  }
  console.log('  ✓ 8 Site Visit records updated with complete data');

  // Map of all field metadata IDs on note
  const fMap = {
    visitId: visitIdFieldId,
    buyerLead: buyerLeadFieldId,
    property: propertyFieldId,
    visitDate: visitDateFieldId,
    visitTime: visitTimeFieldId,
    assignedAgent: agentFieldId,
    visitStatus: visitStatusFieldId,
    feedback: feedbackFieldId,
    nextActionDate: nextActionDateFieldId,
  };

  const sysFields = await c.query(`SELECT id, name FROM core."fieldMetadata" WHERE "workspaceId" = $1 AND "objectMetadataId" = $2`, [wsId, noteObjId]);
  sysFields.rows.forEach(r => { fMap[r.name] = r.id; });

  const requiredOrderedFields = [
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

  // 9. Configure Creation Form (RECORD_FORM layout - "+ Create" Drawer)
  console.log('\n📋 Configuring Creation Form (RECORD_FORM layout)...');
  const creationLayoutRes = await c.query(`
    SELECT id FROM core."pageLayout" 
    WHERE "workspaceId" = $1 AND "objectMetadataId" = $2 AND type = 'RECORD_FORM'
  `, [wsId, noteObjId]);

  if (creationLayoutRes.rows.length > 0) {
    const creationLayoutId = creationLayoutRes.rows[0].id;
    const tabRes = await c.query(`SELECT id FROM core."pageLayoutTab" WHERE "pageLayoutId" = $1 LIMIT 1`, [creationLayoutId]);
    if (tabRes.rows.length > 0) {
      const tabId = tabRes.rows[0].id;
      await c.query(`DELETE FROM core."pageLayoutWidget" WHERE "pageLayoutTabId" = $1`, [tabId]);

      for (let i = 0; i < requiredOrderedFields.length; i++) {
        const fn = requiredOrderedFields[i];
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
            noteObjId,
            JSON.stringify({ row: 0, column: 0, rowSpan: 1, columnSpan: 12 }),
            JSON.stringify({ fieldMetadataId: fId, configurationType: 'FORM_FIELD' }),
            JSON.stringify({ index: i, layoutMode: 'VERTICAL_LIST' }),
          ]);
        }
      }
      console.log('  ✓ Configured 9 FORM_FIELD widgets on Creation Form in exact requested order');
    }
  }

  // 10. Configure FIELDS_WIDGET View (Side Panel / Record Page Fields)
  console.log('\n🗂️  Configuring FIELDS_WIDGET View...');
  const fieldsWidgetViewRes = await c.query(`
    SELECT id FROM core.view 
    WHERE "workspaceId" = $1 AND "objectMetadataId" = $2 AND type = 'FIELDS_WIDGET'
  `, [wsId, noteObjId]);

  let fwViewId;
  if (fieldsWidgetViewRes.rows.length > 0) {
    fwViewId = fieldsWidgetViewRes.rows[0].id;
  } else {
    const newViewRes = await c.query(`
      INSERT INTO core.view (
        id, "universalIdentifier", name, "objectMetadataId", type, icon, position,
        "isCompact", "isCustom", "openRecordIn", "workspaceId", "applicationId",
        visibility, "isActive", "isSystemSideEffect", "groupLoadLimit", "createdAt", "updatedAt"
      ) VALUES (
        gen_random_uuid(), gen_random_uuid(), 'Note Record Page Fields', $1, 'FIELDS_WIDGET', 'IconListDetails', 0,
        false, false, 'SIDE_PANEL', $2, $3,
        'WORKSPACE', true, true, 8, NOW(), NOW()
      ) RETURNING id;
    `, [noteObjId, wsId, stdAppId]);
    fwViewId = newViewRes.rows[0].id;
  }

  await c.query(`DELETE FROM core."viewField" WHERE "viewId" = $1`, [fwViewId]);
  await c.query(`DELETE FROM core."viewFieldGroup" WHERE "viewId" = $1`, [fwViewId]);

  const groupsDef = [
    {
      name: 'Visit Details',
      position: 0,
      fields: ['visitId', 'visitStatus', 'visitDate', 'visitTime', 'nextActionDate'],
    },
    {
      name: 'Parties & Property',
      position: 1,
      fields: ['buyerLead', 'property', 'assignedAgent'],
    },
    {
      name: 'Visit Feedback',
      position: 2,
      fields: ['feedback'],
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
  console.log('  ✓ Configured FIELDS_WIDGET View with all 4 field groups');

  // 11. Configure Table Views (All Site Visits)
  console.log('\n📊 Configuring Table Views for Site Visits...');
  const tableViewsRes = await c.query(`
    SELECT id, name FROM core.view 
    WHERE "workspaceId" = $1 AND "objectMetadataId" = $2 AND type = 'TABLE'
  `, [wsId, noteObjId]);

  const tableColSizes = {
    visitId: 130,
    buyerLead: 200,
    property: 230,
    visitDate: 140,
    visitTime: 130,
    assignedAgent: 180,
    visitStatus: 140,
    feedback: 270,
    nextActionDate: 150,
  };

  for (const tv of tableViewsRes.rows) {
    await c.query(`DELETE FROM core."viewField" WHERE "viewId" = $1`, [tv.id]);
    for (let i = 0; i < requiredOrderedFields.length; i++) {
      const fn = requiredOrderedFields[i];
      const fId = fMap[fn];
      const sz = tableColSizes[fn] || 150;
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
    console.log(`  ✓ Synced 9 columns to Table View: ${tv.name} (${tv.id})`);
  }

  // 12. Bump Workspace Metadata Cache Version
  await c.query(`UPDATE core.workspace SET "metadataVersion" = "metadataVersion" + 1 WHERE id = $1`, [wsId]);
  console.log('\n✨ Incremented workspace metadataVersion');

  await c.end();
  console.log('\n🎉 Site Visits Module fields provisioning completed successfully!');
}

provisionSiteVisitsFields().catch(err => {
  console.error('❌ Error executing Site Visits provisioning:', err);
  process.exit(1);
});

