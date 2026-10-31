const { Client } = require('pg');

async function main() {
  const c = new Client({
    connectionString: process.env.PG_DATABASE_URL || 'postgres://postgres:postgres@db:5432/default',
  });
  await c.connect();

  console.log('🚀 Enhancing Views & Record Page Fields for Buyers & Leads...');

  const wsRes = await c.query(`SELECT id, "displayName", "databaseSchema" FROM core.workspace WHERE "deletedAt" IS NULL`);
  for (const ws of wsRes.rows) {
    const wsId = ws.id;
    const dbSchema = ws.databaseSchema;

    const appRes = await c.query(`
      SELECT id FROM core.application WHERE "workspaceId" = $1 ORDER BY "createdAt" ASC LIMIT 1
    `, [wsId]);
    const appId = appRes.rows[0].id;

    const personObjRes = await c.query(`
      SELECT id FROM core."objectMetadata" WHERE "workspaceId" = $1 AND "nameSingular" = 'person'
    `, [wsId]);
    if (personObjRes.rows.length === 0) continue;
    const personObjId = personObjRes.rows[0].id;

    // Field Map
    const fieldsRes = await c.query(`
      SELECT id, name, label FROM core."fieldMetadata" WHERE "objectMetadataId" = $1
    `, [personObjId]);
    const fieldMap = {};
    fieldsRes.rows.forEach(r => { fieldMap[r.name] = r.id; });

    // 1. Configure Record Page Fields (FIELDS_WIDGET)
    const fieldsWidgetRes = await c.query(`
      SELECT id FROM core."view" 
      WHERE "workspaceId" = $1 AND "objectMetadataId" = $2 AND type = 'FIELDS_WIDGET'
      LIMIT 1
    `, [wsId, personObjId]);

    if (fieldsWidgetRes.rows.length > 0) {
      const widgetViewId = fieldsWidgetRes.rows[0].id;
      console.log(`\n📋 Configuring FIELDS_WIDGET (Record Details Page) [${widgetViewId}]...`);

      // Find General group
      let generalGroupRes = await c.query(`
        SELECT id FROM core."viewFieldGroup" 
        WHERE "viewId" = $1 AND name = 'General'
      `, [widgetViewId]);

      let generalGroupId = generalGroupRes.rows.length > 0 ? generalGroupRes.rows[0].id : null;
      if (!generalGroupId) {
        const newGroup = await c.query(`
          INSERT INTO core."viewFieldGroup" (
            id, "universalIdentifier", name, position, "isVisible",
            "viewId", "workspaceId", "applicationId", "createdAt", "updatedAt"
          ) VALUES (
            gen_random_uuid(), gen_random_uuid(), 'General', 0, true,
            $1, $2, $3, NOW(), NOW()
          ) RETURNING id
        `, [widgetViewId, wsId, appId]);
        generalGroupId = newGroup.rows[0].id;
      }

      // Fields to display on the Record Details Page in General group
      const recordPageFields = [
        'leadId',
        'leadStage',
        'leadSource',
        'requirement',
        'preferredPropertyType',
        'budgetMin',
        'budgetMax',
        'preferredLocation',
        'assignedAgent',
        'emails',
        'phones',
      ];

      for (let pos = 0; pos < recordPageFields.length; pos++) {
        const fName = recordPageFields[pos];
        const fId = fieldMap[fName];
        if (!fId) continue;

        const existingVF = await c.query(`
          SELECT id FROM core."viewField" 
          WHERE "viewId" = $1 AND "fieldMetadataId" = $2
        `, [widgetViewId, fId]);

        if (existingVF.rows.length > 0) {
          await c.query(`
            UPDATE core."viewField"
            SET "isVisible" = true, position = $1, "viewFieldGroupId" = $2, size = 200, "updatedAt" = NOW()
            WHERE id = $3
          `, [pos, generalGroupId, existingVF.rows[0].id]);
          console.log(`  ↻ Updated record field: ${fName}`);
        } else {
          await c.query(`
            INSERT INTO core."viewField" (
              id, "universalIdentifier", "fieldMetadataId", "viewId", "workspaceId", "applicationId",
              "isVisible", position, size, "viewFieldGroupId", "isActive", "isSystemSideEffect",
              "createdAt", "updatedAt"
            ) VALUES (
              gen_random_uuid(), gen_random_uuid(), $1, $2, $3, $4,
              true, $5, 200, $6, true, false,
              NOW(), NOW()
            )
          `, [fId, widgetViewId, wsId, appId, pos, generalGroupId]);
          console.log(`  ✓ Inserted record field: ${fName}`);
        }
      }
    }

    // 2. Configure ALL TABLE views for person to have the 12 columns
    const tableViewsRes = await c.query(`
      SELECT id, name FROM core."view" 
      WHERE "workspaceId" = $1 AND "objectMetadataId" = $2 AND type = 'TABLE'
    `, [wsId, personObjId]);

    const targetTableColumns = [
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

    for (const tv of tableViewsRes.rows) {
      console.log(`\n📊 Updating Table View "${tv.name}" [${tv.id}]...`);
      for (let pos = 0; pos < targetTableColumns.length; pos++) {
        const col = targetTableColumns[pos];
        const fId = fieldMap[col.name];
        if (!fId) continue;

        const existingVF = await c.query(`
          SELECT id FROM core."viewField" 
          WHERE "viewId" = $1 AND "fieldMetadataId" = $2
        `, [tv.id, fId]);

        if (existingVF.rows.length > 0) {
          await c.query(`
            UPDATE core."viewField"
            SET "isVisible" = true, position = $1, size = $2, "updatedAt" = NOW()
            WHERE id = $3
          `, [pos, col.size, existingVF.rows[0].id]);
        } else {
          await c.query(`
            INSERT INTO core."viewField" (
              id, "universalIdentifier", "fieldMetadataId", "viewId", "workspaceId", "applicationId",
              "isVisible", position, size, "isActive", "isSystemSideEffect",
              "createdAt", "updatedAt"
            ) VALUES (
              gen_random_uuid(), gen_random_uuid(), $1, $2, $3, $4,
              true, $5, $6, true, false,
              NOW(), NOW()
            )
          `, [fId, tv.id, wsId, appId, pos, col.size]);
        }
      }
      console.log(`  ✓ Synced all 12 columns to "${tv.name}"`);
    }

    // 3. Configure Lead Pipeline (KANBAN) view fields
    const kanbanRes = await c.query(`
      SELECT id FROM core."view" 
      WHERE "workspaceId" = $1 AND "objectMetadataId" = $2 AND type = 'KANBAN'
    `, [wsId, personObjId]);

    for (const kv of kanbanRes.rows) {
      console.log(`\n📌 Updating Kanban Board View [${kv.id}]...`);
      const kanbanCols = ['leadId', 'name', 'preferredPropertyType', 'budgetMax', 'preferredLocation', 'assignedAgent'];
      for (let pos = 0; pos < kanbanCols.length; pos++) {
        const fName = kanbanCols[pos];
        const fId = fieldMap[fName];
        if (!fId) continue;

        const existingVF = await c.query(`
          SELECT id FROM core."viewField" 
          WHERE "viewId" = $1 AND "fieldMetadataId" = $2
        `, [kv.id, fId]);

        if (existingVF.rows.length === 0) {
          await c.query(`
            INSERT INTO core."viewField" (
              id, "universalIdentifier", "fieldMetadataId", "viewId", "workspaceId", "applicationId",
              "isVisible", position, size, "isActive", "isSystemSideEffect",
              "createdAt", "updatedAt"
            ) VALUES (
              gen_random_uuid(), gen_random_uuid(), $1, $2, $3, $4,
              true, $5, 150, true, false,
              NOW(), NOW()
            )
          `, [fId, kv.id, wsId, appId, pos]);
        }
      }
      console.log(`  ✓ Synced card fields to Kanban board`);
    }

    // 4. Invalidate Metadata Cache in Workspace
    await c.query(`UPDATE core.workspace SET "metadataVersion" = "metadataVersion" + 1 WHERE id = $1`, [wsId]);
    console.log(`\n🔄 Incremented workspace metadataVersion.`);
  }

  await c.end();
  console.log('\n✅ All Buyers & Leads views and record page fields successfully updated!');
}

main().catch(console.error);

