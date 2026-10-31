const { Client } = require('pg');

async function fixRelation() {
  const c = new Client({ connectionString: process.env.PG_DATABASE_URL || 'postgres://postgres:postgres@db:5432/default' });
  await c.connect();

  console.log('🔗 Fixing bidirectional relation between person.assignedAgent and workspaceMember...');

  const wsId = '32c2a902-9983-4e13-b6f6-bc96609f8238';
  const personObjId = '7b01aa01-f40c-4510-9cab-47bb9bc69ad8';
  const memberObjId = '5647b1a0-9790-46c0-ab11-8b86f8828c93';
  const assignedAgentFieldId = '6a97e025-d8e1-4237-83f7-6f1796c29802';
  const appId = 'df1c776c-5af7-4952-818b-65a2b7c6b731';

  // 1. Check if reverse field already exists on workspaceMember
  let reverseField = await c.query(`
    SELECT id FROM core."fieldMetadata"
    WHERE "objectMetadataId" = $1 AND name = 'assignedAgentForPeople'
  `, [memberObjId]);

  let reverseFieldId;
  if (reverseField.rows.length === 0) {
    const insertRes = await c.query(`
      INSERT INTO core."fieldMetadata" (
        id, "universalIdentifier", "objectMetadataId", "workspaceId", "applicationId",
        name, label, type, icon, description, settings, "isActive", "isSystem",
        "isUIEditable", "isUIReadOnly", "isNullable", "isLabelSyncedWithName",
        "relationTargetObjectMetadataId", "relationTargetFieldMetadataId",
        "isAuditLogged", "isSystemSideEffect", writability, "createdAt", "updatedAt"
      ) VALUES (
        gen_random_uuid(), gen_random_uuid(), $1, $2, $3,
        'assignedAgentForPeople', 'Assigned Buyers & Leads', 'RELATION', 'IconUsers',
        'Buyers and leads assigned to this agent',
        '{"relationType": "ONE_TO_MANY"}'::jsonb,
        true, false, false, false, false, false,
        $4, $5, true, false, 'OPEN', NOW(), NOW()
      ) RETURNING id;
    `, [memberObjId, wsId, appId, personObjId, assignedAgentFieldId]);
    reverseFieldId = insertRes.rows[0].id;
    console.log(`  ✓ Created reverse relation field on workspaceMember: assignedAgentForPeople (${reverseFieldId})`);
  } else {
    reverseFieldId = reverseField.rows[0].id;
    await c.query(`
      UPDATE core."fieldMetadata"
      SET "relationTargetObjectMetadataId" = $1, "relationTargetFieldMetadataId" = $2, "updatedAt" = NOW()
      WHERE id = $3
    `, [personObjId, assignedAgentFieldId, reverseFieldId]);
    console.log(`  ↻ Updated existing reverse relation field on workspaceMember (${reverseFieldId})`);
  }

  // 2. Update assignedAgent field on person to point to reverseFieldId
  await c.query(`
    UPDATE core."fieldMetadata"
    SET "relationTargetFieldMetadataId" = $1, "updatedAt" = NOW()
    WHERE id = $2;
  `, [reverseFieldId, assignedAgentFieldId]);
  console.log(`  ✓ Linked person.assignedAgent -> workspaceMember.assignedAgentForPeople`);

  // 3. Invalidate Workspace Metadata
  await c.query(`UPDATE core.workspace SET "metadataVersion" = "metadataVersion" + 1 WHERE id = $1`, [wsId]);
  console.log(`  🔄 Incremented workspace metadataVersion.`);

  await c.end();
  console.log('✅ Relation fix complete!');
}

fixRelation().catch(console.error);

