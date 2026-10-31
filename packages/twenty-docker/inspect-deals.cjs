const { Client } = require('pg');

async function inspectDeals() {
  const c = new Client({
    connectionString: process.env.PG_DATABASE_URL || 'postgres://postgres:postgres@db:5432/default',
  });
  await c.connect();

  const schema = 'workspace_306npwj88jcxnl7zwdogk8bw8';

  const deals = await c.query(`SELECT id, name, "amountAmountMicros", "closeDate", stage, "companyId", "pointOfContactId", "ownerId" FROM ${schema}.opportunity`);
  console.log('Existing Deals in schema:', deals.rows);

  await c.end();
}

inspectDeals().catch(console.error);

