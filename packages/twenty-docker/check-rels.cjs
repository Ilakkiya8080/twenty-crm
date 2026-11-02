const { Client } = require('pg');

async function checkRelations() {
  const c = new Client({
    connectionString: process.env.PG_DATABASE_URL || 'postgres://postgres:postgres@db:5432/default',
  });
  await c.connect();

  const wsId = '32c2a902-9983-4e13-b6f6-bc96609f8238';

  const rels = await c.query(`
    SELECT fm.name, fm.label, fm.type, fm."relationTargetObjectMetadataId", om."nameSingular", om."labelSingular" as "targetLabel"
    FROM core."fieldMetadata" fm
    LEFT JOIN core."objectMetadata" om ON om.id = fm."relationTargetObjectMetadataId"
    WHERE fm."workspaceId" = $1 AND fm."objectMetadataId" = (
      SELECT id FROM core."objectMetadata" WHERE "workspaceId" = $1 AND "nameSingular" = 'opportunity'
    ) AND fm.name IN ('pointOfContact', 'company', 'owner')
  `, [wsId]);
  console.log('Opportunity relations:', rels.rows);

  await c.end();
}

checkRelations().catch(console.error);
