const { Client } = require('pg');

async function run() {
  const c = new Client({ connectionString: process.env.PG_DATABASE_URL || 'postgres://postgres:postgres@db:5432/default' });
  await c.connect();

  const apps = await c.query(`
    SELECT * FROM core.application WHERE "workspaceId" = '32c2a902-9983-4e13-b6f6-bc96609f8238';
  `);
  console.log('Applications in workspace 32c2a902-9983-4e13-b6f6-bc96609f8238:');
  console.table(apps.rows);

  const fields = await c.query(`
    SELECT id, name, label, "applicationId", "isActive", "isSystem"
    FROM core."fieldMetadata"
    WHERE "workspaceId" = '32c2a902-9983-4e13-b6f6-bc96609f8238'
      AND "objectMetadataId" = '7b01aa01-f40c-4510-9cab-47bb9bc69ad8'
    ORDER BY name;
  `);
  console.log('Person fields:');
  console.table(fields.rows);

  // Compare with company fields!
  const compFields = await c.query(`
    SELECT id, name, label, "applicationId", "isActive", "isSystem"
    FROM core."fieldMetadata"
    WHERE "workspaceId" = '32c2a902-9983-4e13-b6f6-bc96609f8238'
      AND "name" IN ('propertyId', 'propertyType', 'bedrooms')
    ORDER BY name;
  `);
  console.log('Company custom fields:');
  console.table(compFields.rows);

  await c.end();
}

run().catch(console.error);
