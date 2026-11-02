const { Client } = require('pg');

async function checkAssigneeReverse() {
  const c = new Client({
    connectionString: process.env.PG_DATABASE_URL || 'postgres://postgres:postgres@db:5432/default',
  });
  await c.connect();

  const wsId = '32c2a902-9983-4e13-b6f6-bc96609f8238';

  const rev = await c.query(`
    SELECT id, name, label, type, "relationTargetObjectMetadataId", "relationTargetFieldMetadataId"
    FROM core."fieldMetadata"
    WHERE "workspaceId" = $1 AND "objectMetadataId" = (
      SELECT id FROM core."objectMetadata" WHERE "workspaceId" = $1 AND "nameSingular" = 'workspaceMember'
    ) AND name ILIKE '%task%'
  `, [wsId]);
  console.log('Task relations on workspaceMember:', rev.rows);

  await c.end();
}

checkAssigneeReverse().catch(console.error);

