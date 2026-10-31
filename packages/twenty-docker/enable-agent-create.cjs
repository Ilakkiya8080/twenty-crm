const { Client } = require('pg');

async function run() {
  const client = new Client({ connectionString: process.env.PG_DATABASE_URL || 'postgres://postgres:postgres@db:5432/default' });
  await client.connect();

  const wsId = '32c2a902-9983-4e13-b6f6-bc96609f8238';

  const ws = await client.query(`SELECT id, "databaseSchema" FROM core.workspace WHERE id = $1`, [wsId]);
  const schema = ws.rows[0].databaseSchema;

  // 1. Alter workspaceMember table in PostgreSQL
  console.log(`Altering ${schema}."workspaceMember" columns...`);
  await client.query(`
    ALTER TABLE ${schema}."workspaceMember" ALTER COLUMN "userId" DROP NOT NULL;
    ALTER TABLE ${schema}."workspaceMember" ALTER COLUMN "userId" SET DEFAULT gen_random_uuid();
  `);

  // 2. Update objectMetadata for workspaceMember
  console.log('Enabling isUICreatable and isUIEditable on workspaceMember objectMetadata...');
  const objRes = await client.query(`
    UPDATE core."objectMetadata"
    SET "isUICreatable" = true,
        "isUIEditable" = true,
        "isUIReadOnly" = false
    WHERE "workspaceId" = $1 AND "nameSingular" = 'workspaceMember'
    RETURNING id;
  `, [wsId]);
  const memberObjId = objRes.rows[0].id;
  console.log('Updated workspaceMember objectMetadataId:', memberObjId);

  // 3. Update fieldMetadata for editable columns
  console.log('Making Agent fields UI editable...');
  await client.query(`
    UPDATE core."fieldMetadata"
    SET "isUIEditable" = true
    WHERE "objectMetadataId" = $1 AND name IN ('name', 'jobTitle', 'userEmail', 'avatarUrl');
  `, [memberObjId]);

  await client.query(`
    UPDATE core."fieldMetadata"
    SET "isNullable" = true,
        "defaultValue" = $1
    WHERE "objectMetadataId" = $2 AND name = 'userId';
  `, [JSON.stringify('uuid'), memberObjId]);

  // Also make sure name is editable
  await client.query(`
    UPDATE core."fieldMetadata"
    SET "isUIEditable" = true,
        "isNullable" = true
    WHERE "objectMetadataId" = $1 AND name = 'name';
  `, [memberObjId]);

  // 4. Invalidate metadata cache
  console.log('Incrementing metadataVersion...');
  await client.query(`
    UPDATE core.workspace
    SET "metadataVersion" = "metadataVersion" + 1
    WHERE id = $1;
  `, [wsId]);

  console.log('Successfully enabled create button and editable fields for Agents module!');
  await client.end();
}

run().catch(console.error);
