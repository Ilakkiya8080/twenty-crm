const { Client } = require('pg');

async function checkLabelIdentifiers() {
  const c = new Client({
    connectionString: process.env.PG_DATABASE_URL || 'postgres://postgres:postgres@db:5432/default',
  });
  await c.connect();

  const wsId = '32c2a902-9983-4e13-b6f6-bc96609f8238';

  const om = await c.query(`
    SELECT om."nameSingular", om."labelSingular", fm.name as "idFieldName", fm.label as "idFieldLabel"
    FROM core."objectMetadata" om
    LEFT JOIN core."fieldMetadata" fm ON fm.id = om."labelIdentifierFieldMetadataId"
    WHERE om."workspaceId" = $1 AND om."nameSingular" IN ('person', 'company', 'opportunity', 'workspaceMember', 'task')
  `, [wsId]);
  console.log('Label Identifiers:', om.rows);

  await c.end();
}

checkLabelIdentifiers().catch(console.error);
