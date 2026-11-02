const { Client } = require('pg');

async function checkSiteVisitRels() {
  const c = new Client({
    connectionString: process.env.PG_DATABASE_URL || 'postgres://postgres:postgres@db:5432/default',
  });
  await c.connect();

  const wsId = '32c2a902-9983-4e13-b6f6-bc96609f8238';

  const r = await c.query(`
    SELECT fm.id, fm.name, fm.label, om."nameSingular" 
    FROM core."fieldMetadata" fm
    JOIN core."objectMetadata" om ON om.id = fm."objectMetadataId"
    WHERE fm."workspaceId" = $1 AND fm.name ILIKE '%visit%'
  `, [wsId]);
  console.log('Existing fields with "visit":', r.rows);

  await c.end();
}

checkSiteVisitRels().catch(console.error);

