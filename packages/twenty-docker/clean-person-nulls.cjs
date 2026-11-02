const { Client } = require('pg');

async function clean() {
  const client = new Client({ connectionString: process.env.PG_DATABASE_URL || 'postgres://postgres:postgres@db:5432/default' });
  await client.connect();
  const res = await client.query('DELETE FROM workspace_306npwj88jcxnl7zwdogk8bw8.person WHERE "nameFirstName" IS NULL AND "nameLastName" IS NULL AND "leadId" IS NULL;');
  console.log('Deleted null rows:', res.rowCount);
  await client.end();
}

clean().catch(console.error);

