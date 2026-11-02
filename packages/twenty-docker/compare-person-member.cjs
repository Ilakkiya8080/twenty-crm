const { Client } = require('pg');

async function run() {
  const client = new Client({ connectionString: process.env.PG_DATABASE_URL || 'postgres://postgres:postgres@db:5432/default' });
  await client.connect();

  const wsId = '32c2a902-9983-4e13-b6f6-bc96609f8238';

  const om = await client.query(`
    SELECT "nameSingular", "isUICreatable", "isUIEditable", "isUIReadOnly", "isSystem"
    FROM core."objectMetadata"
    WHERE "workspaceId" = $1 AND "nameSingular" IN ('person', 'company', 'workspaceMember', 'note', 'opportunity');
  `, [wsId]);
  console.table(om.rows);

  const fm = await client.query(`
    SELECT fm.name, fm."isUIEditable", fm."isNullable"
    FROM core."fieldMetadata" fm
    JOIN core."objectMetadata" om ON fm."objectMetadataId" = om.id
    WHERE om."workspaceId" = $1 AND om."nameSingular" = 'person'
    LIMIT 10;
  `, [wsId]);
  console.log('person fields:');
  console.table(fm.rows);

  await client.end();
}

run().catch(console.error);

