const { Client } = require('pg');

async function run() {
  const client = new Client({ connectionString: process.env.PG_DATABASE_URL || 'postgres://postgres:postgres@db:5432/default' });
  await client.connect();

  const wsId = '32c2a902-9983-4e13-b6f6-bc96609f8238';

  // Check objectMetadata for workspaceMember
  const obj = await client.query(`
    SELECT id, "nameSingular", "namePlural", "labelSingular", "labelPlural", "isSystem", "isRemote", "isActive", "isUIEditable", "isUICreatable", "isUIReadOnly", writability
    FROM core."objectMetadata"
    WHERE "workspaceId" = $1 AND "nameSingular" = 'workspaceMember';
  `, [wsId]);
  console.log('workspaceMember metadata:');
  console.log(obj.rows[0]);

  // Check all field metadata for workspaceMember
  const fields = await client.query(`
    SELECT name, type, "isUIEditable", "isNullable", "defaultValue", writability
    FROM core."fieldMetadata"
    WHERE "objectMetadataId" = $1
    ORDER BY name;
  `, [obj.rows[0].id]);
  console.log('workspaceMember fields:');
  console.table(fields.rows);

  await client.end();
}

run().catch(console.error);

