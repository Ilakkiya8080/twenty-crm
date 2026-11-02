const { Client } = require('pg');

async function run() {
  const client = new Client({ connectionString: process.env.PG_DATABASE_URL || 'postgres://postgres:postgres@db:5432/default' });
  await client.connect();

  const wsId = '32c2a902-9983-4e13-b6f6-bc96609f8238';

  const commands = await client.query(`
    SELECT id, label, "shortLabel", icon, "isPinned", "availabilityType", "conditionalAvailabilityExpression"
    FROM core."commandMenuItem"
    WHERE "workspaceId" = $1;
  `, [wsId]);
  console.log('Command menu items for workspace:');
  console.table(commands.rows);

  // Check if any command menu items are linked or if standard command menu items exist
  const allCmds = await client.query(`
    SELECT id, label, "shortLabel", "availabilityType", "conditionalAvailabilityExpression", "workspaceId"
    FROM core."commandMenuItem"
    LIMIT 20;
  `);
  console.log('All command menu items:');
  console.table(allCmds.rows);

  await client.end();
}

run().catch(console.error);

