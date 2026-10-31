const { Client } = require('pg');

async function run() {
  const c = new Client({ connectionString: process.env.PG_DATABASE_URL || 'postgres://postgres:postgres@db:5432/default' });
  await c.connect();

  const res = await c.query(`
    SELECT id, "nameFirstName", "nameLastName", "emailsPrimaryEmail", "phonesPrimaryPhoneNumber", "jobTitle"
    FROM workspace_306npwj88jcxnl7zwdogk8bw8.person
    WHERE "deletedAt" IS NULL;
  `);
  console.log(`Found ${res.rows.length} people in person table:`);
  console.table(res.rows);

  await c.end();
}

run().catch(console.error);

