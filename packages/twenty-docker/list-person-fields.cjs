const { Client } = require('pg');

async function run() {
  const c = new Client({ connectionString: process.env.PG_DATABASE_URL || 'postgres://postgres:postgres@db:5432/default' });
  await c.connect();
  const res = await c.query(`
    SELECT f.id, f.name, f.label, f.type, f."relationTargetObjectMetadataId", om."nameSingular" as "targetObject"
    FROM core."fieldMetadata" f
    LEFT JOIN core."objectMetadata" om ON f."relationTargetObjectMetadataId" = om.id
    WHERE f."workspaceId" = '32c2a902-9983-4e13-b6f6-bc96609f8238' 
      AND f."objectMetadataId" = '7b01aa01-f40c-4510-9cab-47bb9bc69ad8' 
    ORDER BY f.name;
  `);
  console.table(res.rows);
  await c.end();
}

run().catch(console.error);

