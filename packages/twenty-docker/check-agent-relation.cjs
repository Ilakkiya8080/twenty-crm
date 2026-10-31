const { Client } = require('pg');

async function run() {
  const c = new Client({ connectionString: process.env.PG_DATABASE_URL || 'postgres://postgres:postgres@db:5432/default' });
  await c.connect();

  const memObj = await c.query(`
    SELECT id FROM core."objectMetadata" WHERE "workspaceId" = '32c2a902-9983-4e13-b6f6-bc96609f8238' AND "nameSingular" = 'workspaceMember';
  `);
  const memObjId = memObj.rows[0].id;
  console.log('workspaceMember Object Metadata ID in active workspace:', memObjId);

  const memFields = await c.query(`
    SELECT id, name, label, type, "relationTargetObjectMetadataId", "relationTargetFieldMetadataId"
    FROM core."fieldMetadata"
    WHERE "objectMetadataId" = $1
    ORDER BY name;
  `, [memObjId]);
  console.log('workspaceMember fields:');
  console.table(memFields.rows);

  const assignedAgentField = await c.query(`
    SELECT *
    FROM core."fieldMetadata"
    WHERE "workspaceId" = '32c2a902-9983-4e13-b6f6-bc96609f8238' AND name = 'assignedAgent';
  `);
  console.log('\nassignedAgent fieldMetadata:');
  console.log(assignedAgentField.rows[0]);

  await c.end();
}

run().catch(console.error);

