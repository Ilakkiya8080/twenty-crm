const { Client } = require('pg');

async function run() {
  const client = new Client({ connectionString: process.env.PG_DATABASE_URL || 'postgres://postgres:postgres@db:5432/default' });
  await client.connect();

  const wsId = '32c2a902-9983-4e13-b6f6-bc96609f8238';

  const perms = await client.query(`
    SELECT op.id, op."roleId", r.label as role, om."nameSingular", op."canReadObjectRecords", op."canUpdateObjectRecords", op."canSoftDeleteObjectRecords", op."canDestroyObjectRecords"
    FROM core."objectPermission" op
    JOIN core.role r ON op."roleId" = r.id
    JOIN core."objectMetadata" om ON op."objectMetadataId" = om.id
    WHERE op."workspaceId" = $1;
  `, [wsId]);
  console.log('Object permissions:');
  console.table(perms.rows);

  await client.end();
}

run().catch(console.error);

