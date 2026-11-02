const { Client } = require('pg');

async function inspectTriggers() {
  const c = new Client({
    connectionString: process.env.PG_DATABASE_URL || 'postgres://postgres:postgres@db:5432/default',
  });
  await c.connect();

  const schema = 'workspace_306npwj88jcxnl7zwdogk8bw8';

  const trgs = await c.query(`
    SELECT trigger_name, event_manipulation, action_statement
    FROM information_schema.triggers
    WHERE event_object_schema = $1 AND event_object_table = 'company'
  `, [schema]);
  console.log('Triggers on company:', trgs.rows);

  const seqs = await c.query(`
    SELECT sequence_name FROM information_schema.sequences WHERE sequence_schema = $1
  `, [schema]);
  console.log('Sequences in schema:', seqs.rows);

  await c.end();
}

inspectTriggers().catch(console.error);

