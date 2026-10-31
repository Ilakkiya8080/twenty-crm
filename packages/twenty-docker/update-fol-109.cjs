const { Client } = require('pg');

async function update109() {
  const c = new Client({
    connectionString: process.env.PG_DATABASE_URL || 'postgres://postgres:postgres@db:5432/default',
  });
  await c.connect();

  const schema = 'workspace_306npwj88jcxnl7zwdogk8bw8';
  await c.query(`
    UPDATE ${schema}.task 
    SET "leadId" = '44444444-0001-4000-8000-000000000001', 
        "relatedDealId" = '66666666-0001-4000-8000-000000000001', 
        "relatedPropertyId" = '33333333-0001-4000-8000-000000000001',
        "assigneeId" = 'cdb44bb1-b831-4641-952d-eedd1a739e66',
        status = 'PENDING', 
        notes = 'Initial introduction call and property wishlist review.', 
        "dueAt" = now() + interval '1 day', 
        "nextFollowUpDate" = CURRENT_DATE + interval '3 days' 
    WHERE "followUpId" = 'FOL-109';
  `);

  await c.end();
}

update109().catch(console.error);

