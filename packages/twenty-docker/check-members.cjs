const { Client } = require('pg');

async function run() {
  const c = new Client({ connectionString: process.env.PG_DATABASE_URL || 'postgres://postgres:postgres@db:5432/default' });
  await c.connect();

  const members = await c.query(`
    SELECT id, "nameFirstName", "nameLastName", "userEmail"
    FROM workspace_306npwj88jcxnl7zwdogk8bw8."workspaceMember"
    LIMIT 10;
  `);
  console.log('Workspace Members (Agents):');
  console.table(members.rows);

  await c.end();
}

run().catch(console.error);

