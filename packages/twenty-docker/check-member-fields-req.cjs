const { Client } = require('pg');

async function run() {
  const client = new Client({ connectionString: process.env.PG_DATABASE_URL || 'postgres://postgres:postgres@db:5432/default' });
  await client.connect();

  const wsId = '32c2a902-9983-4e13-b6f6-bc96609f8238';

  const res = await client.query(`
    SELECT fm.name, fm.type, fm."isNullable", fm."defaultValue", fm."isUIEditable"
    FROM core."fieldMetadata" fm
    JOIN core."objectMetadata" om ON fm."objectMetadataId" = om.id
    WHERE om."workspaceId" = $1 AND om."nameSingular" = 'workspaceMember'
    ORDER BY fm."isNullable", fm.name;
  `, [wsId]);
  console.log('workspaceMember fields nullability:');
  console.table(res.rows);

  await client.end();
}

run().catch(console.error);

