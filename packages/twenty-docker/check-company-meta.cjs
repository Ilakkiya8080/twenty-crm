const { Client } = require('pg');

async function checkCompanyMeta() {
  const c = new Client({
    connectionString: process.env.PG_DATABASE_URL || 'postgres://postgres:postgres@db:5432/default',
  });
  await c.connect();

  const wsId = '32c2a902-9983-4e13-b6f6-bc96609f8238';

  const r = await c.query(`
    SELECT id, name, label FROM core."fieldMetadata" 
    WHERE "workspaceId" = $1 AND "objectMetadataId" = (
      SELECT id FROM core."objectMetadata" WHERE "workspaceId" = $1 AND "nameSingular" = 'company'
    ) AND name ILIKE '%follow%'
  `, [wsId]);
  console.log('Follow-ups on company:', r.rows);

  await c.end();
}

checkCompanyMeta().catch(console.error);

