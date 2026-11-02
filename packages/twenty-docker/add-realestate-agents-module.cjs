const { Client } = require('pg');

async function run() {
  const client = new Client({
    connectionString: process.env.PG_DATABASE_URL || 'postgres://postgres:postgres@db:5432/default'
  });
  await client.connect();

  const wsId = '32c2a902-9983-4e13-b6f6-bc96609f8238';

  // 1. Get workspace details
  const wsRes = await client.query(`SELECT id, "databaseSchema" FROM core.workspace WHERE id = $1`, [wsId]);
  const dbSchema = wsRes.rows[0].databaseSchema;

  // 2. Get Application ID
  let appId = null;
  const appRes = await client.query(`SELECT id FROM core."application" WHERE "workspaceId" = $1 LIMIT 1`, [wsId]);
  if (appRes.rows.length > 0) {
    appId = appRes.rows[0].id;
  }

  // 3. Get workspaceMember objectMetadata
  const memberObjRes = await client.query(`
    SELECT id FROM core."objectMetadata"
    WHERE "workspaceId" = $1 AND "nameSingular" = 'workspaceMember'
  `, [wsId]);
  const memberObjId = memberObjRes.rows[0].id;

  console.log('workspaceMember objectMetadataId:', memberObjId);

  // 4. Update objectMetadata for workspaceMember
  await client.query(`
    UPDATE core."objectMetadata"
    SET "labelPlural" = 'Agents & Brokers',
        "labelSingular" = 'Agent',
        icon = 'IconUserCheck',
        color = 'purple',
        "isActive" = true
    WHERE id = $1;
  `, [memberObjId]);

  // 5. Update or insert Navigation Menu Item for Agents (position 6)
  const existingNav = await client.query(`
    SELECT id FROM core."navigationMenuItem"
    WHERE "workspaceId" = $1 AND "targetObjectMetadataId" = $2;
  `, [wsId, memberObjId]);

  if (existingNav.rows.length === 0) {
    await client.query(`
      INSERT INTO core."navigationMenuItem" (
        id, "universalIdentifier", "workspaceId", "applicationId", "targetObjectMetadataId",
        position, type, color, icon, name, "createdAt", "updatedAt"
      ) VALUES (
        gen_random_uuid(), gen_random_uuid(), $1, $2, $3,
        6, 'OBJECT', 'purple', 'IconUserCheck', 'Agents', NOW(), NOW()
      );
    `, [wsId, appId, memberObjId]);
    console.log('Inserted Agents navigationMenuItem at position 6');
  } else {
    await client.query(`
      UPDATE core."navigationMenuItem"
      SET name = 'Agents',
          icon = 'IconUserCheck',
          color = 'purple',
          position = 6
      WHERE id = $1;
    `, [existingNav.rows[0].id]);
    console.log('Updated existing Agents navigationMenuItem');
  }

  // 6. Update Table View for workspaceMember
  const viewRes = await client.query(`
    SELECT id FROM core."view"
    WHERE "workspaceId" = $1 AND "objectMetadataId" = $2 AND type = 'TABLE'
    LIMIT 1;
  `, [wsId, memberObjId]);

  let viewId = null;
  if (viewRes.rows.length > 0) {
    viewId = viewRes.rows[0].id;
    await client.query(`
      UPDATE core."view"
      SET name = 'All Agents', icon = 'IconUserCheck'
      WHERE id = $1;
    `, [viewId]);
    console.log(`Updated view ${viewId} name to 'All Agents'`);
  }

  // 7. Configure ViewFields for the Agents view
  if (viewId) {
    // Get fields: name, userEmail, jobTitle, assignedAgentForPeople, ownedOpportunities
    const fieldsRes = await client.query(`
      SELECT id, name FROM core."fieldMetadata"
      WHERE "objectMetadataId" = $1;
    `, [memberObjId]);
    const fMap = {};
    fieldsRes.rows.forEach(f => { fMap[f.name] = f.id; });

    // Hide all currently visible viewFields first
    await client.query(`UPDATE core."viewField" SET "isVisible" = false WHERE "viewId" = $1;`, [viewId]);

    const targetCols = [
      { name: 'name', size: 220, pos: 0 },
      { name: 'userEmail', size: 220, pos: 1 },
      { name: 'jobTitle', size: 240, pos: 2 },
      { name: 'assignedAgentForPeople', size: 200, pos: 3 },
      { name: 'ownedOpportunities', size: 180, pos: 4 },
    ];

    for (const col of targetCols) {
      const fId = fMap[col.name];
      if (!fId) continue;

      const existingVf = await client.query(`
        SELECT id FROM core."viewField" WHERE "viewId" = $1 AND "fieldMetadataId" = $2;
      `, [viewId, fId]);

      if (existingVf.rows.length > 0) {
        await client.query(`
          UPDATE core."viewField"
          SET "isVisible" = true, position = $1, size = $2
          WHERE id = $3;
        `, [col.pos, col.size, existingVf.rows[0].id]);
      } else {
        await client.query(`
          INSERT INTO core."viewField" (
            id, "universalIdentifier", "viewId", "fieldMetadataId", position, "isVisible", size,
            "workspaceId", "applicationId", "createdAt", "updatedAt"
          ) VALUES (
            gen_random_uuid(), gen_random_uuid(), $1, $2, $3, true, $4,
            $5, $6, NOW(), NOW()
          );
        `, [viewId, fId, col.pos, col.size, wsId, appId]);
      }
    }
    console.log('Configured viewFields for All Agents view');
  }

  // 8. Seed Realistic Real Estate Agents
  // Update ilakkiya s to Principal Broker
  await client.query(`
    UPDATE ${dbSchema}."workspaceMember"
    SET "jobTitle" = 'Principal Broker & Agency Director'
    WHERE "userEmail" = 'ilakkiya8080@gmail.com';
  `);

  // Agents list
  const agents = [
    {
      uid: '77777777-1001-4000-8000-000000000001',
      memberId: '88888888-1001-4000-8000-000000000001',
      fn: 'Marcus',
      ln: 'Vance',
      email: 'marcus.vance@twentyestates.com',
      title: 'Senior Commercial & Luxury Specialist'
    },
    {
      uid: '77777777-1002-4000-8000-000000000002',
      memberId: '88888888-1002-4000-8000-000000000002',
      fn: 'Elena',
      ln: 'Rostova',
      email: 'elena.rostova@twentyestates.com',
      title: 'Luxury Residential Property Specialist'
    },
    {
      uid: '77777777-1003-4000-8000-000000000003',
      memberId: '88888888-1003-4000-8000-000000000003',
      fn: 'Carlos',
      ln: 'Morales',
      email: 'carlos.morales@twentyestates.com',
      title: 'New Developments & Land Consultant'
    },
    {
      uid: '77777777-1004-4000-8000-000000000004',
      memberId: '88888888-1004-4000-8000-000000000004',
      fn: 'Sarah',
      ln: 'Jenkins',
      email: 'sarah.jenkins@twentyestates.com',
      title: 'Residential Leasing & Sales Agent'
    }
  ];

  for (let i = 0; i < agents.length; i++) {
    const a = agents[i];
    // Clean up if existing
    await client.query(`DELETE FROM core."userWorkspace" WHERE "userId" = $1`, [a.uid]);
    await client.query(`DELETE FROM core."user" WHERE id = $1 OR email = $2`, [a.uid, a.email]);

    // Create user
    await client.query(`
      INSERT INTO core."user" (id, "firstName", "lastName", email, "isEmailVerified", "createdAt", "updatedAt")
      VALUES ($1, $2, $3, $4, true, NOW(), NOW())
    `, [a.uid, a.fn, a.ln, a.email]);

    // Create userWorkspace
    await client.query(`
      INSERT INTO core."userWorkspace" (id, "userId", "workspaceId", "createdAt", "updatedAt")
      VALUES (gen_random_uuid(), $1, $2, NOW(), NOW())
    `, [a.uid, wsId]);

    // Create or update workspaceMember
    await client.query(`DELETE FROM ${dbSchema}."workspaceMember" WHERE id = $1`, [a.memberId]);
    await client.query(`
      INSERT INTO ${dbSchema}."workspaceMember" (
        id, "nameFirstName", "nameLastName", "jobTitle", "userEmail", "userId", position,
        "colorScheme", "uiScale", "openRecordIn", "locale", "calendarStartDay", "timeZone",
        "dateFormat", "timeFormat", "numberFormat", "createdBySource", "createdByName", "updatedBySource", "updatedByName",
        "createdAt", "updatedAt"
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7,
        'System', 'Medium', 'USER_CHOICE', 'en', 1, 'UTC',
        'SYSTEM', 'SYSTEM', 'SYSTEM', 'SYSTEM', 'System', 'SYSTEM', 'System',
        NOW(), NOW()
      );
    `, [a.memberId, a.fn, a.ln, a.title, a.email, a.uid, i + 2]);
  }
  console.log('Seeded 4 realistic real estate agents');

  // 9. Assign some Buyers & Leads to these agents for realistic relationships
  const agentIds = [
    '88888888-1001-4000-8000-000000000001', // Marcus
    '88888888-1002-4000-8000-000000000002', // Elena
    '88888888-1003-4000-8000-000000000003', // Carlos
    '88888888-1004-4000-8000-000000000004', // Sarah
  ];

  const leads = await client.query(`SELECT id FROM ${dbSchema}.person ORDER BY "createdAt" ASC`);
  for (let i = 0; i < leads.rows.length; i++) {
    const agId = agentIds[i % agentIds.length];
    await client.query(`UPDATE ${dbSchema}.person SET "assignedAgentId" = $1 WHERE id = $2`, [agId, leads.rows[i].id]);
  }
  console.log(`Assigned agents across ${leads.rows.length} Buyers & Leads`);

  // 10. Increment metadataVersion
  await client.query(`
    UPDATE core.workspace
    SET "metadataVersion" = "metadataVersion" + 1
    WHERE id = $1;
  `, [wsId]);
  console.log('Incremented metadataVersion');

  await client.end();
}

run().catch(console.error);

