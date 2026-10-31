const { Client } = require('pg');

async function provisionFollowUpFields() {
  const c = new Client({
    connectionString: process.env.PG_DATABASE_URL || 'postgres://postgres:postgres@db:5432/default',
  });
  await c.connect();

  const wsId = '32c2a902-9983-4e13-b6f6-bc96609f8238';
  const schema = 'workspace_306npwj88jcxnl7zwdogk8bw8';

  console.log('🚀 Starting Real Estate Follow-ups (task) Module Provisioning...');

  // 1. Fetch Applications
  const stdAppRes = await c.query(`SELECT id FROM core.application WHERE "workspaceId" = $1 AND name = 'Standard' LIMIT 1`, [wsId]);
  const customAppRes = await c.query(`SELECT id FROM core.application WHERE "workspaceId" = $1 AND name = 'Custom' LIMIT 1`, [wsId]);
  const stdAppId = stdAppRes.rows.length > 0 ? stdAppRes.rows[0].id : null;
  const customAppId = customAppRes.rows.length > 0 ? customAppRes.rows[0].id : stdAppId;

  // 2. Fetch Object Metadata IDs
  const taskObjRes = await c.query(`SELECT id FROM core."objectMetadata" WHERE "workspaceId" = $1 AND "nameSingular" = 'task'`, [wsId]);
  const personObjRes = await c.query(`SELECT id FROM core."objectMetadata" WHERE "workspaceId" = $1 AND "nameSingular" = 'person'`, [wsId]);
  const oppObjRes = await c.query(`SELECT id FROM core."objectMetadata" WHERE "workspaceId" = $1 AND "nameSingular" = 'opportunity'`, [wsId]);
  const memberObjRes = await c.query(`SELECT id FROM core."objectMetadata" WHERE "workspaceId" = $1 AND "nameSingular" = 'workspaceMember'`, [wsId]);

  const taskObjId = taskObjRes.rows[0].id;
  const personObjId = personObjRes.rows[0].id;
  const oppObjId = oppObjRes.rows[0].id;
  const memberObjId = memberObjRes.rows[0].id;

  console.log('✓ Task Object Metadata ID:', taskObjId);
  console.log('✓ Person Object Metadata ID:', personObjId);
  console.log('✓ Opportunity Object Metadata ID:', oppObjId);
  console.log('✓ WorkspaceMember Object Metadata ID:', memberObjId);

  // 3. PostgreSQL Enums & Columns Preparation
  console.log('🐘 Configuring PostgreSQL Enums and Sequence...');
  await c.query(`
    DO $$
    BEGIN
      -- Ensure task_status_enum has PENDING, COMPLETED, CANCELLED
      IF NOT EXISTS (SELECT 1 FROM pg_type t JOIN pg_enum e ON t.oid = e.enumtypid JOIN pg_namespace n ON n.oid = t.typnamespace WHERE t.typname = 'task_status_enum' AND n.nspname = '${schema}' AND e.enumlabel = 'PENDING') THEN
        ALTER TYPE ${schema}."task_status_enum" ADD VALUE 'PENDING';
      END IF;
      IF NOT EXISTS (SELECT 1 FROM pg_type t JOIN pg_enum e ON t.oid = e.enumtypid JOIN pg_namespace n ON n.oid = t.typnamespace WHERE t.typname = 'task_status_enum' AND n.nspname = '${schema}' AND e.enumlabel = 'COMPLETED') THEN
        ALTER TYPE ${schema}."task_status_enum" ADD VALUE 'COMPLETED';
      END IF;
      IF NOT EXISTS (SELECT 1 FROM pg_type t JOIN pg_enum e ON t.oid = e.enumtypid JOIN pg_namespace n ON n.oid = t.typnamespace WHERE t.typname = 'task_status_enum' AND n.nspname = '${schema}' AND e.enumlabel = 'CANCELLED') THEN
        ALTER TYPE ${schema}."task_status_enum" ADD VALUE 'CANCELLED';
      END IF;

      -- Create task_followUpType_enum
      IF NOT EXISTS (SELECT 1 FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace WHERE t.typname = 'task_followUpType_enum' AND n.nspname = '${schema}') THEN
        CREATE TYPE ${schema}."task_followUpType_enum" AS ENUM ('CALL', 'EMAIL', 'MEETING', 'MESSAGE');
      END IF;
    END $$;
  `);

  await c.query(`CREATE SEQUENCE IF NOT EXISTS ${schema}.task_followup_id_seq START WITH 109;`);

  // Physical columns on task table
  await c.query(`
    ALTER TABLE ${schema}.task ADD COLUMN IF NOT EXISTS "followUpId" text;
    ALTER TABLE ${schema}.task ADD COLUMN IF NOT EXISTS "followUpType" ${schema}."task_followUpType_enum" DEFAULT 'CALL';
    ALTER TABLE ${schema}.task ADD COLUMN IF NOT EXISTS "leadId" uuid;
    ALTER TABLE ${schema}.task ADD COLUMN IF NOT EXISTS "relatedDealId" uuid;
    ALTER TABLE ${schema}.task ADD COLUMN IF NOT EXISTS "notes" text;
    ALTER TABLE ${schema}.task ADD COLUMN IF NOT EXISTS "nextFollowUpDate" date;
  `);
  console.log('  ✓ Physical columns ready in task table');

  // 4. Update Existing Standard Fields on task
  console.log('✏️  Updating existing standard fields on task...');

  // 4.1 Assigned Agent (assignee, Relation -> Agents / Users)
  await c.query(`
    UPDATE core."fieldMetadata"
    SET label = 'Assigned Agent', icon = 'IconUserCheck', description = 'Real estate agent assigned to this follow-up'
    WHERE "workspaceId" = $1 AND "objectMetadataId" = $2 AND name = 'assignee'
  `, [wsId, taskObjId]);

  // 4.2 Due Date & Time (dueAt, Date & Time)
  await c.query(`
    UPDATE core."fieldMetadata"
    SET label = 'Due Date & Time', icon = 'IconClock', description = 'Scheduled date and time for the follow-up action'
    WHERE "workspaceId" = $1 AND "objectMetadataId" = $2 AND name = 'dueAt'
  `, [wsId, taskObjId]);

  // 4.3 Status (status, Select: Pending / Completed / Cancelled)
  const statusOptions = [
    { id: '20202020-0001-4860-ad07-5c4603d44887', color: 'yellow', label: 'Pending', value: 'PENDING', position: 0 },
    { id: '20202020-0002-4860-ad07-5c4603d44888', color: 'green', label: 'Completed', value: 'COMPLETED', position: 1 },
    { id: '20202020-0003-4860-ad07-5c4603d44889', color: 'red', label: 'Cancelled', value: 'CANCELLED', position: 2 },
  ];
  await c.query(`
    UPDATE core."fieldMetadata"
    SET label = 'Status', icon = 'IconProgressCheck', description = 'Select: Pending / Completed / Cancelled',
        options = $1, "defaultValue" = $2
    WHERE "workspaceId" = $3 AND "objectMetadataId" = $4 AND name = 'status'
  `, [JSON.stringify(statusOptions), JSON.stringify("'PENDING'"), wsId, taskObjId]);

  console.log('  ✓ Updated assignee, dueAt, and status metadata');

  // 5. Create / Update Custom Fields on task
  console.log('➕ Creating / updating custom fields in core."fieldMetadata"...');

  // 5.1 Follow-up ID (followUpId, Text, Auto-generated / unique)
  let followUpIdRes = await c.query(`SELECT id FROM core."fieldMetadata" WHERE "workspaceId" = $1 AND "objectMetadataId" = $2 AND name = 'followUpId'`, [wsId, taskObjId]);
  let followUpIdFieldId;
  if (followUpIdRes.rows.length === 0) {
    const ins = await c.query(`
      INSERT INTO core."fieldMetadata" (
        id, "universalIdentifier", "objectMetadataId", "workspaceId", "applicationId",
        name, label, type, icon, description, "isActive", "isSystem",
        "isUIEditable", "isUIReadOnly", "isNullable", "isLabelSyncedWithName",
        "createdAt", "updatedAt"
      ) VALUES (
        gen_random_uuid(), gen_random_uuid(), $1, $2, $3,
        'followUpId', 'Follow-up ID', 'TEXT', 'IconHash', 'Auto-generated unique follow-up identifier (e.g. FOL-101)',
        true, false, true, false, true, false,
        NOW(), NOW()
      ) RETURNING id;
    `, [taskObjId, wsId, customAppId]);
    followUpIdFieldId = ins.rows[0].id;
    console.log('  ✓ Created followUpId field (ID:', followUpIdFieldId, ')');
  } else {
    followUpIdFieldId = followUpIdRes.rows[0].id;
    await c.query(`
      UPDATE core."fieldMetadata"
      SET label = 'Follow-up ID', icon = 'IconHash', description = 'Auto-generated unique follow-up identifier (e.g. FOL-101)', "updatedAt" = NOW()
      WHERE id = $1
    `, [followUpIdFieldId]);
  }

  // Set followUpId as labelIdentifierFieldMetadataId on objectMetadata
  await c.query(`
    UPDATE core."objectMetadata"
    SET "labelIdentifierFieldMetadataId" = $1, "updatedAt" = NOW()
    WHERE id = $2
  `, [followUpIdFieldId, taskObjId]);
  console.log('  ✓ Configured followUpId as primary label identifier for task');

  // 5.2 Follow-up Type (followUpType, Select: Call / Email / Meeting / Message)
  const followUpTypeOptions = [
    { id: '30303030-0001-4860-ad07-5c4603d44881', color: 'blue', label: 'Call', value: 'CALL', position: 0 },
    { id: '30303030-0002-4860-ad07-5c4603d44882', color: 'purple', label: 'Email', value: 'EMAIL', position: 1 },
    { id: '30303030-0003-4860-ad07-5c4603d44883', color: 'green', label: 'Meeting', value: 'MEETING', position: 2 },
    { id: '30303030-0004-4860-ad07-5c4603d44884', color: 'orange', label: 'Message', value: 'MESSAGE', position: 3 },
  ];
  let futRes = await c.query(`SELECT id FROM core."fieldMetadata" WHERE "workspaceId" = $1 AND "objectMetadataId" = $2 AND name = 'followUpType'`, [wsId, taskObjId]);
  let futFieldId;
  if (futRes.rows.length === 0) {
    const ins = await c.query(`
      INSERT INTO core."fieldMetadata" (
        id, "universalIdentifier", "objectMetadataId", "workspaceId", "applicationId",
        name, label, type, icon, description, options, "defaultValue",
        "isActive", "isSystem", "isUIEditable", "isUIReadOnly", "isNullable", "isLabelSyncedWithName",
        "createdAt", "updatedAt"
      ) VALUES (
        gen_random_uuid(), gen_random_uuid(), $1, $2, $3,
        'followUpType', 'Follow-up Type', 'SELECT', 'IconListCheck', 'Select: Call / Email / Meeting / Message',
        $4, $5,
        true, false, true, false, true, false,
        NOW(), NOW()
      ) RETURNING id;
    `, [taskObjId, wsId, customAppId, JSON.stringify(followUpTypeOptions), JSON.stringify("'CALL'")]);
    futFieldId = ins.rows[0].id;
    console.log('  ✓ Created followUpType field (ID:', futFieldId, ')');
  } else {
    futFieldId = futRes.rows[0].id;
    await c.query(`
      UPDATE core."fieldMetadata"
      SET label = 'Follow-up Type', icon = 'IconListCheck', description = 'Select: Call / Email / Meeting / Message',
          options = $1, "defaultValue" = $2, "updatedAt" = NOW()
      WHERE id = $3
    `, [JSON.stringify(followUpTypeOptions), JSON.stringify("'CALL'"), futFieldId]);
  }

  // 5.3 Notes (notes, Long text)
  let notesRes = await c.query(`SELECT id FROM core."fieldMetadata" WHERE "workspaceId" = $1 AND "objectMetadataId" = $2 AND name = 'notes'`, [wsId, taskObjId]);
  let notesFieldId;
  if (notesRes.rows.length === 0) {
    const ins = await c.query(`
      INSERT INTO core."fieldMetadata" (
        id, "universalIdentifier", "objectMetadataId", "workspaceId", "applicationId",
        name, label, type, icon, description, "isActive", "isSystem",
        "isUIEditable", "isUIReadOnly", "isNullable", "isLabelSyncedWithName",
        "createdAt", "updatedAt"
      ) VALUES (
        gen_random_uuid(), gen_random_uuid(), $1, $2, $3,
        'notes', 'Notes', 'TEXT', 'IconNotes', 'Detailed notes, call summary, or meeting log',
        true, false, true, false, true, false,
        NOW(), NOW()
      ) RETURNING id;
    `, [taskObjId, wsId, customAppId]);
    notesFieldId = ins.rows[0].id;
    console.log('  ✓ Created notes field (ID:', notesFieldId, ')');
  } else {
    notesFieldId = notesRes.rows[0].id;
    await c.query(`
      UPDATE core."fieldMetadata"
      SET label = 'Notes', icon = 'IconNotes', description = 'Detailed notes, call summary, or meeting log', "updatedAt" = NOW()
      WHERE id = $1
    `, [notesFieldId]);
  }

  // 5.4 Next Follow-up Date (nextFollowUpDate, Date)
  let nfdRes = await c.query(`SELECT id FROM core."fieldMetadata" WHERE "workspaceId" = $1 AND "objectMetadataId" = $2 AND name = 'nextFollowUpDate'`, [wsId, taskObjId]);
  let nfdFieldId;
  if (nfdRes.rows.length === 0) {
    const ins = await c.query(`
      INSERT INTO core."fieldMetadata" (
        id, "universalIdentifier", "objectMetadataId", "workspaceId", "applicationId",
        name, label, type, icon, description, "isActive", "isSystem",
        "isUIEditable", "isUIReadOnly", "isNullable", "isLabelSyncedWithName",
        "createdAt", "updatedAt"
      ) VALUES (
        gen_random_uuid(), gen_random_uuid(), $1, $2, $3,
        'nextFollowUpDate', 'Next Follow-up Date', 'DATE', 'IconCalendarForward', 'Date for next check-in or subsequent follow-up action',
        true, false, true, false, true, false,
        NOW(), NOW()
      ) RETURNING id;
    `, [taskObjId, wsId, customAppId]);
    nfdFieldId = ins.rows[0].id;
    console.log('  ✓ Created nextFollowUpDate field (ID:', nfdFieldId, ')');
  } else {
    nfdFieldId = nfdRes.rows[0].id;
    await c.query(`
      UPDATE core."fieldMetadata"
      SET label = 'Next Follow-up Date', icon = 'IconCalendarForward', description = 'Date for next check-in or subsequent follow-up action', "updatedAt" = NOW()
      WHERE id = $1
    `, [nfdFieldId]);
  }

  // 6. Create / Update Bidirectional Relations
  console.log('🔗 Setting up Bidirectional Relations...');

  // 6.1 Lead: task.lead (MANY_TO_ONE) <-> person.followUps (ONE_TO_MANY)
  let leadRelTask = await c.query(`SELECT id FROM core."fieldMetadata" WHERE "workspaceId" = $1 AND "objectMetadataId" = $2 AND name = 'lead'`, [wsId, taskObjId]);
  let followUpsPerson = await c.query(`SELECT id FROM core."fieldMetadata" WHERE "workspaceId" = $1 AND "objectMetadataId" = $2 AND name = 'followUps'`, [wsId, personObjId]);

  let leadFieldId, personFollowUpsFieldId;

  if (followUpsPerson.rows.length === 0) {
    const ins = await c.query(`
      INSERT INTO core."fieldMetadata" (
        id, "universalIdentifier", "objectMetadataId", "workspaceId", "applicationId",
        name, label, type, icon, description, settings, "isActive", "isSystem",
        "isUIEditable", "isUIReadOnly", "isNullable", "isLabelSyncedWithName",
        "relationTargetObjectMetadataId", "createdAt", "updatedAt"
      ) VALUES (
        gen_random_uuid(), gen_random_uuid(), $1, $2, $3,
        'followUps', 'Follow-ups', 'RELATION', 'IconPhoneCall', 'Follow-up actions and communications for this buyer/lead',
        '{"relationType": "ONE_TO_MANY"}'::jsonb, true, false,
        false, false, false, false,
        $4, NOW(), NOW()
      ) RETURNING id;
    `, [personObjId, wsId, customAppId, taskObjId]);
    personFollowUpsFieldId = ins.rows[0].id;
  } else {
    personFollowUpsFieldId = followUpsPerson.rows[0].id;
  }

  if (leadRelTask.rows.length === 0) {
    const ins = await c.query(`
      INSERT INTO core."fieldMetadata" (
        id, "universalIdentifier", "objectMetadataId", "workspaceId", "applicationId",
        name, label, type, icon, description, settings, "isActive", "isSystem",
        "isUIEditable", "isUIReadOnly", "isNullable", "isLabelSyncedWithName",
        "relationTargetObjectMetadataId", "relationTargetFieldMetadataId", "createdAt", "updatedAt"
      ) VALUES (
        gen_random_uuid(), gen_random_uuid(), $1, $2, $3,
        'lead', 'Lead', 'RELATION', 'IconUser', 'Buyer or lead associated with this follow-up',
        '{"relationType": "MANY_TO_ONE", "joinColumnName": "leadId"}'::jsonb, true, false,
        true, false, true, false,
        $4, $5, NOW(), NOW()
      ) RETURNING id;
    `, [taskObjId, wsId, customAppId, personObjId, personFollowUpsFieldId]);
    leadFieldId = ins.rows[0].id;
  } else {
    leadFieldId = leadRelTask.rows[0].id;
    await c.query(`
      UPDATE core."fieldMetadata"
      SET label = 'Lead', icon = 'IconUser', "relationTargetObjectMetadataId" = $1, "relationTargetFieldMetadataId" = $2, "updatedAt" = NOW()
      WHERE id = $3
    `, [personObjId, personFollowUpsFieldId, leadFieldId]);
  }

  // Update reverse target on person
  await c.query(`UPDATE core."fieldMetadata" SET "relationTargetFieldMetadataId" = $1 WHERE id = $2`, [leadFieldId, personFollowUpsFieldId]);
  console.log('  ✓ Bidirectional relation linked: task.lead <-> person.followUps');

  // 6.2 Related Deal: task.relatedDeal (MANY_TO_ONE) <-> opportunity.followUps (ONE_TO_MANY)
  let dealRelTask = await c.query(`SELECT id FROM core."fieldMetadata" WHERE "workspaceId" = $1 AND "objectMetadataId" = $2 AND name = 'relatedDeal'`, [wsId, taskObjId]);
  let followUpsOpp = await c.query(`SELECT id FROM core."fieldMetadata" WHERE "workspaceId" = $1 AND "objectMetadataId" = $2 AND name = 'followUps'`, [wsId, oppObjId]);

  let dealFieldId, oppFollowUpsFieldId;

  if (followUpsOpp.rows.length === 0) {
    const ins = await c.query(`
      INSERT INTO core."fieldMetadata" (
        id, "universalIdentifier", "objectMetadataId", "workspaceId", "applicationId",
        name, label, type, icon, description, settings, "isActive", "isSystem",
        "isUIEditable", "isUIReadOnly", "isNullable", "isLabelSyncedWithName",
        "relationTargetObjectMetadataId", "createdAt", "updatedAt"
      ) VALUES (
        gen_random_uuid(), gen_random_uuid(), $1, $2, $3,
        'followUps', 'Follow-ups', 'RELATION', 'IconPhoneCall', 'Follow-up actions and logs for this real estate deal',
        '{"relationType": "ONE_TO_MANY"}'::jsonb, true, false,
        false, false, false, false,
        $4, NOW(), NOW()
      ) RETURNING id;
    `, [oppObjId, wsId, customAppId, taskObjId]);
    oppFollowUpsFieldId = ins.rows[0].id;
  } else {
    oppFollowUpsFieldId = followUpsOpp.rows[0].id;
  }

  if (dealRelTask.rows.length === 0) {
    const ins = await c.query(`
      INSERT INTO core."fieldMetadata" (
        id, "universalIdentifier", "objectMetadataId", "workspaceId", "applicationId",
        name, label, type, icon, description, settings, "isActive", "isSystem",
        "isUIEditable", "isUIReadOnly", "isNullable", "isLabelSyncedWithName",
        "relationTargetObjectMetadataId", "relationTargetFieldMetadataId", "createdAt", "updatedAt"
      ) VALUES (
        gen_random_uuid(), gen_random_uuid(), $1, $2, $3,
        'relatedDeal', 'Related Deal', 'RELATION', 'IconBriefcase', 'Real estate deal associated with this follow-up (optional)',
        '{"relationType": "MANY_TO_ONE", "joinColumnName": "relatedDealId"}'::jsonb, true, false,
        true, false, true, false,
        $4, $5, NOW(), NOW()
      ) RETURNING id;
    `, [taskObjId, wsId, customAppId, oppObjId, oppFollowUpsFieldId]);
    dealFieldId = ins.rows[0].id;
  } else {
    dealFieldId = dealRelTask.rows[0].id;
    await c.query(`
      UPDATE core."fieldMetadata"
      SET label = 'Related Deal', icon = 'IconBriefcase', "relationTargetObjectMetadataId" = $1, "relationTargetFieldMetadataId" = $2, "updatedAt" = NOW()
      WHERE id = $3
    `, [oppObjId, oppFollowUpsFieldId, dealFieldId]);
  }

  // Update reverse target on opportunity
  await c.query(`UPDATE core."fieldMetadata" SET "relationTargetFieldMetadataId" = $1 WHERE id = $2`, [dealFieldId, oppFollowUpsFieldId]);
  console.log('  ✓ Bidirectional relation linked: task.relatedDeal <-> opportunity.followUps');

  // 7. Auto-generation trigger for task
  console.log('⚡ Installing auto-identifier trigger for Follow-ups...');
  await c.query(`
    CREATE OR REPLACE FUNCTION ${schema}.task_sync_followup_fn()
    RETURNS TRIGGER AS $$
    BEGIN
      IF NEW."followUpId" IS NULL OR NEW."followUpId" = '' THEN
        NEW."followUpId" := 'FOL-' || nextval('${schema}.task_followup_id_seq'::regclass)::text;
      END IF;
      NEW.title := NEW."followUpId" || ' (' || COALESCE(NEW."followUpType"::text, 'FOLLOW-UP') || ')';
      RETURN NEW;
    END;
    $$ LANGUAGE plpgsql;

    DROP TRIGGER IF EXISTS task_sync_followup_trigger ON ${schema}.task;
    CREATE TRIGGER task_sync_followup_trigger
    BEFORE INSERT OR UPDATE ON ${schema}.task
    FOR EACH ROW EXECUTE FUNCTION ${schema}.task_sync_followup_fn();
  `);
  console.log('  ✓ Auto-generation trigger installed');

  // 8. Clean up and populate realistic sample follow-ups
  console.log('📊 Updating sample Follow-up records in schema:', schema);
  await c.query(`DELETE FROM ${schema}.task WHERE title IS NULL AND "followUpId" IS NULL`);

  const sampleTasks = [
    {
      id: '77777777-0001-4000-8000-000000000001',
      followUpId: 'FOL-101',
      leadId: '44444444-0001-4000-8000-000000000001', // Alexander Wright
      relatedDealId: '66666666-0001-4000-8000-000000000001', // Skyline Grand Penthouse Purchase
      followUpType: 'CALL',
      dueAt: '2026-11-01T10:00:00Z',
      assigneeId: 'cdb44bb1-b831-4641-952d-eedd1a739e66', // Jessica Taylor
      status: 'PENDING',
      notes: 'Counter-offer review on penthouse deed & escrow timeline. Client requested 30-day closing window.',
      nextFollowUpDate: '2026-11-04',
    },
    {
      id: '77777777-0002-4000-8000-000000000002',
      followUpId: 'FOL-102',
      leadId: '44444444-0002-4000-8000-000000000002', // Sophia Martinez
      relatedDealId: '66666666-0002-4000-8000-000000000002', // Emerald Valley Villa 4B Acquisition
      followUpType: 'MEETING',
      dueAt: '2026-11-02T14:00:00Z',
      assigneeId: '88888888-1002-4000-8000-000000000002', // Elena Rostova
      status: 'PENDING',
      notes: 'Finalize title deed documentation & notary appointment at downtown office.',
      nextFollowUpDate: '2026-11-06',
    },
    {
      id: '77777777-0003-4000-8000-000000000003',
      followUpId: 'FOL-103',
      leadId: '44444444-0003-4000-8000-000000000003', // Devin Chen
      relatedDealId: '66666666-0003-4000-8000-000000000003', // Oasis Commercial Plaza 5-Year Lease
      followUpType: 'MESSAGE',
      dueAt: '2026-11-02T16:30:00Z',
      assigneeId: '88888888-1001-4000-8000-000000000001', // Marcus Vance
      status: 'PENDING',
      notes: 'Send revised commercial lease agreement with tenant improvement allowance breakdown.',
      nextFollowUpDate: '2026-11-05',
    },
    {
      id: '77777777-0004-4000-8000-000000000004',
      followUpId: 'FOL-104',
      leadId: '44444444-0004-4000-8000-000000000004', // Priya Sharma
      relatedDealId: '66666666-0004-4000-8000-000000000004', // Grand Horizon Apt 1204 Annual Lease
      followUpType: 'EMAIL',
      dueAt: '2026-10-30T11:00:00Z',
      assigneeId: '88888888-1004-4000-8000-000000000004', // Sarah Jenkins
      status: 'COMPLETED',
      notes: 'Sent digital lease agreement and security deposit wire transfer instructions.',
      nextFollowUpDate: '2026-11-03',
    },
    {
      id: '77777777-0005-4000-8000-000000000005',
      followUpId: 'FOL-105',
      leadId: '44444444-0005-4000-8000-000000000005', // Michael O'Connor
      relatedDealId: '66666666-0005-4000-8000-000000000005', // Sunset Bay Waterfront Villa Closing
      followUpType: 'MEETING',
      dueAt: '2026-10-31T13:00:00Z',
      assigneeId: '88888888-1003-4000-8000-000000000003', // Carlos Morales
      status: 'COMPLETED',
      notes: 'Handover villa keys, garage remotes, and smart home automation credentials.',
      nextFollowUpDate: '2026-11-15',
    },
    {
      id: '77777777-0006-4000-8000-000000000006',
      followUpId: 'FOL-106',
      leadId: '44444444-0006-4000-8000-000000000006', // Rachel Green
      relatedDealId: '66666666-0006-4000-8000-000000000006', // Harmony Heights 3BHK Purchase
      followUpType: 'CALL',
      dueAt: '2026-11-03T11:30:00Z',
      assigneeId: '88888888-1002-4000-8000-000000000002', // Elena Rostova
      status: 'PENDING',
      notes: 'Confirm pre-approval mortgage letter from lender and review down-payment receipt.',
      nextFollowUpDate: '2026-11-07',
    },
    {
      id: '77777777-0007-4000-8000-000000000007',
      followUpId: 'FOL-107',
      leadId: '44444444-0007-4000-8000-000000000007', // Vikram Patel
      relatedDealId: '66666666-0007-4000-8000-000000000007', // Silicon Square Tech Hub Acquisition
      followUpType: 'EMAIL',
      dueAt: '2026-11-03T15:00:00Z',
      assigneeId: '88888888-1001-4000-8000-000000000001', // Marcus Vance
      status: 'PENDING',
      notes: 'Provide commercial property environmental clearance report and structural inspection certificates.',
      nextFollowUpDate: '2026-11-08',
    },
    {
      id: '77777777-0008-4000-8000-000000000008',
      followUpId: 'FOL-108',
      leadId: '44444444-0008-4000-8000-000000000008', // Emma Watson
      relatedDealId: '66666666-0008-4000-8000-000000000008', // Greenfield Villa Plot 18 Contract
      followUpType: 'CALL',
      dueAt: '2026-11-04T10:00:00Z',
      assigneeId: '88888888-1003-4000-8000-000000000003', // Carlos Morales
      status: 'CANCELLED',
      notes: 'Coordinate with civil site surveyor for boundary demarcation and corner stone placement.',
      nextFollowUpDate: '2026-11-09',
    },
  ];

  for (const t of sampleTasks) {
    await c.query(`
      UPDATE ${schema}.task
      SET "followUpId" = $1,
          "leadId" = $2,
          "relatedDealId" = $3,
          "followUpType" = $4::${schema}."task_followUpType_enum",
          "dueAt" = $5::timestamptz,
          "assigneeId" = $6,
          status = $7::${schema}."task_status_enum",
          notes = $8,
          "nextFollowUpDate" = $9::date
      WHERE id = $10
    `, [
      t.followUpId, t.leadId, t.relatedDealId, t.followUpType,
      t.dueAt, t.assigneeId, t.status, t.notes, t.nextFollowUpDate,
      t.id
    ]);
  }
  console.log('  ✓ Updated 8 existing tasks with real estate follow-up attributes');

  // 9. Fetch all field IDs on task
  const allFieldsRes = await c.query(`
    SELECT id, name FROM core."fieldMetadata" 
    WHERE "workspaceId" = $1 AND "objectMetadataId" = $2
  `, [wsId, taskObjId]);
  const fMap = {};
  allFieldsRes.rows.forEach(r => { fMap[r.name] = r.id; });

  // 10. Configure Creation Form (RECORD_FORM layout) - for clicking "+ Create"
  console.log('📋 Configuring Creation Form (RECORD_FORM layout)...');
  const creationLayoutRes = await c.query(`
    SELECT id FROM core."pageLayout" 
    WHERE "workspaceId" = $1 AND "objectMetadataId" = $2 AND type = 'RECORD_FORM'
  `, [wsId, taskObjId]);

  if (creationLayoutRes.rows.length > 0) {
    const creationLayoutId = creationLayoutRes.rows[0].id;
    const tabRes = await c.query(`
      SELECT id FROM core."pageLayoutTab" 
      WHERE "pageLayoutId" = $1 ORDER BY position LIMIT 1
    `, [creationLayoutId]);

    if (tabRes.rows.length > 0) {
      const tabId = tabRes.rows[0].id;

      // Delete old widgets
      await c.query(`DELETE FROM core."pageLayoutWidget" WHERE "pageLayoutTabId" = $1`, [tabId]);

      // Fields in exact requested order:
      // 1. Follow-up ID (followUpId)
      // 2. Lead (lead)
      // 3. Related Deal (relatedDeal)
      // 4. Follow-up Type (followUpType)
      // 5. Due Date & Time (dueAt)
      // 6. Assigned Agent (assignee)
      // 7. Status (status)
      // 8. Notes (notes)
      // 9. Next Follow-up Date (nextFollowUpDate)
      const formFields = [
        'followUpId',
        'lead',
        'relatedDeal',
        'followUpType',
        'dueAt',
        'assignee',
        'status',
        'notes',
        'nextFollowUpDate',
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
            taskObjId,
            JSON.stringify({ row: 0, column: 0, rowSpan: 1, columnSpan: 12 }),
            JSON.stringify({ fieldMetadataId: fieldId, configurationType: 'FORM_FIELD' }),
            JSON.stringify({ index: i, layoutMode: 'VERTICAL_LIST' }),
          ]);
        }
      }
      console.log('  ✓ Configured 9 FORM_FIELD widgets in Creation Form');
    }
  }

  // 11. Configure FIELDS_WIDGET View (Side Panel / Record Page Fields)
  console.log('🗂️  Configuring FIELDS_WIDGET View...');
  const fieldsWidgetViewRes = await c.query(`
    SELECT id FROM core.view 
    WHERE "workspaceId" = $1 AND "objectMetadataId" = $2 AND type = 'FIELDS_WIDGET'
  `, [wsId, taskObjId]);

  if (fieldsWidgetViewRes.rows.length > 0) {
    const fieldsWidgetViewId = fieldsWidgetViewRes.rows[0].id;

    await c.query(`DELETE FROM core."viewField" WHERE "viewId" = $1`, [fieldsWidgetViewId]);
    await c.query(`DELETE FROM core."viewFieldGroup" WHERE "viewId" = $1`, [fieldsWidgetViewId]);

    const groupDefs = [
      {
        name: 'Follow-up Details',
        position: 0,
        fields: ['followUpId', 'followUpType', 'status', 'dueAt', 'nextFollowUpDate'],
      },
      {
        name: 'Associations',
        position: 1,
        fields: ['lead', 'relatedDeal', 'assignee'],
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
    console.log('  ✓ Configured groups and viewFields in FIELDS_WIDGET view');
  }

  // 12. Configure Table Views (All Follow-ups)
  console.log('📊 Configuring Table Views for Follow-ups...');
  const tableViewsRes = await c.query(`
    SELECT id, key FROM core.view 
    WHERE "workspaceId" = $1 AND "objectMetadataId" = $2 AND type = 'TABLE'
  `, [wsId, taskObjId]);

  const tableColumns = [
    { name: 'followUpId', size: 130 },
    { name: 'lead', size: 180 },
    { name: 'relatedDeal', size: 240 },
    { name: 'followUpType', size: 140 },
    { name: 'dueAt', size: 180 },
    { name: 'assignee', size: 170 },
    { name: 'status', size: 130 },
    { name: 'notes', size: 260 },
    { name: 'nextFollowUpDate', size: 160 },
  ];

  for (const tv of tableViewsRes.rows) {
    await c.query(`DELETE FROM core."viewField" WHERE "viewId" = $1`, [tv.id]);

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
        `, [tv.id, fId, i, col.size, wsId, stdAppId]);
      }
    }
  }
  console.log('  ✓ Configured table columns across all Follow-up table views');

  // 13. Configure Kanban View (All Follow-ups)
  console.log('📌 Configuring Kanban View...');
  const kanbanRes = await c.query(`
    SELECT id FROM core.view 
    WHERE "workspaceId" = $1 AND "objectMetadataId" = $2 AND type = 'KANBAN'
  `, [wsId, taskObjId]);

  if (kanbanRes.rows.length > 0 && fMap['status']) {
    const kanbanId = kanbanRes.rows[0].id;
    await c.query(`
      UPDATE core.view 
      SET "mainGroupByFieldMetadataId" = $1
      WHERE id = $2
    `, [fMap['status'], kanbanId]);

    await c.query(`DELETE FROM core."viewGroup" WHERE "viewId" = $1`, [kanbanId]);

    const kanbanStatuses = ['PENDING', 'COMPLETED', 'CANCELLED'];
    for (let k = 0; k < kanbanStatuses.length; k++) {
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
      `, [kanbanId, kanbanStatuses[k], k, wsId, stdAppId]);
    }
    console.log('  ✓ Configured 3 status columns in Kanban view');
  }

  // 14. Invalidate Metadata Cache
  await c.query(`UPDATE core.workspace SET "metadataVersion" = "metadataVersion" + 1 WHERE id = $1`, [wsId]);
  console.log('✨ Workspace metadata cache version incremented');

  await c.end();
  console.log('\n✅ Follow-ups module provisioning successfully completed!');
}

provisionFollowUpFields().catch(err => {
  console.error('❌ Provisioning Error:', err);
  process.exit(1);
});

