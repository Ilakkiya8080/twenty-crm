const { Client } = require('pg');

async function check() {
  const c = new Client({ connectionString: process.env.PG_DATABASE_URL || 'postgres://postgres:postgres@db:5432/default' });
  await c.connect();

  const ws = await c.query(`
    SELECT id, "displayName", "activationStatus", "databaseSchema"
    FROM core."workspace"
    WHERE "deletedAt" IS NULL
    ORDER BY "createdAt" DESC
    LIMIT 1;
  `);
  const wsId = ws.rows[0].id;
  const schema = ws.rows[0].databaseSchema;
  console.log(`Active Workspace: ${wsId} (Schema: ${schema})`);

  const personObj = await c.query(`
    SELECT id, "nameSingular", "labelSingular", "labelPlural"
    FROM core."objectMetadata"
    WHERE "workspaceId" = $1 AND "nameSingular" = 'person';
  `, [wsId]);
  console.log('Person Object:', personObj.rows[0]);

  const fields = await c.query(`
    SELECT id, name, label, type, "isSystem", "isActive"
    FROM core."fieldMetadata"
    WHERE "workspaceId" = $1 AND "objectMetadataId" = $2
    ORDER BY name ASC;
  `, [wsId, personObj.rows[0].id]);
  console.log(`Fields on person in core.fieldMetadata (${fields.rows.length}):`);
  console.table(fields.rows);

  const cols = await c.query(`
    SELECT column_name, data_type, udt_name
    FROM information_schema.columns
    WHERE table_schema = $1 AND table_name = 'person';
  `, [schema]);
  console.log(`Columns on ${schema}.person (${cols.rows.length}):`);
  console.table(cols.rows);

  const views = await c.query(`
    SELECT id, name, "key", "objectMetadataId"
    FROM core."view"
    WHERE "workspaceId" = $1 AND "objectMetadataId" = $2;
  `, [wsId, personObj.rows[0].id]);
  console.log('Views for person:');
  console.table(views.rows);

  await c.end();
}

check().catch(console.error);
