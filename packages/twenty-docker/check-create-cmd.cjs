const { Client } = require('pg');

async function run() {
  const client = new Client({ connectionString: process.env.PG_DATABASE_URL || 'postgres://postgres:postgres@db:5432/default' });
  await client.connect();

  const wsId = '32c2a902-9983-4e13-b6f6-bc96609f8238';

  const res = await client.query(`
    SELECT id, label, "shortLabel", "isPinned", "availabilityType", "conditionalAvailabilityExpression"
    FROM core."commandMenuItem"
    WHERE "workspaceId" = $1 AND (label ILIKE '%create%' OR "shortLabel" ILIKE '%create%');
  `, [wsId]);
  console.table(res.rows);

  await client.end();
}

run().catch(console.error);

