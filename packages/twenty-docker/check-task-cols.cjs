const { Client } = require('pg');

async function checkTaskConstraints() {
  const c = new Client({
    connectionString: process.env.PG_DATABASE_URL || 'postgres://postgres:postgres@db:5432/default',
  });
  await c.connect();

  const schema = 'workspace_306npwj88jcxnl7zwdogk8bw8';

  const cols = await c.query(`
    SELECT column_name, is_nullable, column_default 
    FROM information_schema.columns 
    WHERE table_schema = $1 AND table_name = 'task'
  `, [schema]);
  console.log('Task column nullability:', cols.rows);

  await c.end();
}

checkTaskConstraints().catch(console.error);

