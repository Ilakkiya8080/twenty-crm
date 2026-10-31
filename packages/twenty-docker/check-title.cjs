const { Client } = require('pg');

async function checkTaskTitle() {
  const c = new Client({
    connectionString: process.env.PG_DATABASE_URL || 'postgres://postgres:postgres@db:5432/default',
  });
  await c.connect();

  const wsId = '32c2a902-9983-4e13-b6f6-bc96609f8238';

  const titleField = await c.query(`
    SELECT * FROM core."fieldMetadata" 
    WHERE "workspaceId" = $1 AND "objectMetadataId" = (
      SELECT id FROM core."objectMetadata" WHERE "workspaceId" = $1 AND "nameSingular" = 'task'
    ) AND name = 'title'
  `, [wsId]);
  console.log('Title fieldMetadata:', titleField.rows[0]);

  await c.end();
}

checkTaskTitle().catch(console.error);

