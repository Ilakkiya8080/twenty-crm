const { Client } = require('pg');

async function verify() {
  const c = new Client({
    connectionString: process.env.PG_DATABASE_URL || 'postgres://postgres:postgres@db:5432/default',
  });
  await c.connect();

  const ws = await c.query(`
    SELECT id, "displayName", "databaseSchema"
    FROM core."workspace"
    WHERE "deletedAt" IS NULL
    ORDER BY "createdAt" DESC
    LIMIT 1;
  `);
  const wsId = ws.rows[0].id;
  const schema = ws.rows[0].databaseSchema;

  console.log(`=== VERIFYING BUYERS & LEADS FIELDS IN WORKSPACE: ${wsId} ===`);

  const personObj = await c.query(`
    SELECT id, "nameSingular", "labelSingular", "labelPlural"
    FROM core."objectMetadata"
    WHERE "workspaceId" = $1 AND "nameSingular" = 'person';
  `, [wsId]);
  console.log('Object:', personObj.rows[0]);

  const view = await c.query(`
    SELECT id, name, "key", type
    FROM core."view"
    WHERE "workspaceId" = $1 AND "objectMetadataId" = $2 AND "key" = 'INDEX';
  `, [wsId, personObj.rows[0].id]);
  console.log('Table View:', view.rows[0]);

  const viewFields = await c.query(`
    SELECT vf."position", f.name, f.label, f.type, vf."isVisible", vf.size
    FROM core."viewField" vf
    JOIN core."fieldMetadata" f ON vf."fieldMetadataId" = f.id
    WHERE vf."viewId" = $1
    ORDER BY vf."position" ASC;
  `, [view.rows[0].id]);
  console.log('\n=== VIEW FIELDS IN ALL BUYERS & LEADS TABLE VIEW ===');
  console.table(viewFields.rows);

  const kanban = await c.query(`
    SELECT id, name, type, icon, "mainGroupByFieldMetadataId"
    FROM core."view"
    WHERE "workspaceId" = $1 AND "objectMetadataId" = $2 AND type = 'KANBAN';
  `, [wsId, personObj.rows[0].id]);
  console.log('\n=== KANBAN PIPELINE VIEW ===');
  console.table(kanban.rows);

  const kanbanGroups = await c.query(`
    SELECT vg."position", vg."fieldValue", vg."isVisible"
    FROM core."viewGroup" vg
    WHERE vg."viewId" = $1
    ORDER BY vg."position" ASC;
  `, [kanban.rows[0].id]);
  console.log('Kanban Columns (Stages):');
  console.table(kanbanGroups.rows);

  const rows = await c.query(`
    SELECT 
      "leadId",
      "nameFirstName" || ' ' || "nameLastName" AS "fullName",
      "phonesPrimaryPhoneNumber" AS "phone",
      "emailsPrimaryEmail" AS "email",
      "leadSource",
      "requirement",
      "preferredPropertyType",
      ("budgetMinAmountMicros" / 1000000.0) AS "budgetMin",
      ("budgetMaxAmountMicros" / 1000000.0) AS "budgetMax",
      "preferredLocation",
      "leadStage"
    FROM ${schema}.person
    WHERE "deletedAt" IS NULL
    ORDER BY "leadId" ASC;
  `);
  console.log('\n=== SAMPLE LEADS DATA IN PERSON TABLE ===');
  console.table(rows.rows);

  await c.end();
}

verify().catch(console.error);

