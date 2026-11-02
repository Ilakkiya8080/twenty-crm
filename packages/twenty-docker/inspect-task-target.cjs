const { Client } = require('pg');

async function inspectTaskTarget() {
  const c = new Client({
    connectionString: process.env.PG_DATABASE_URL || 'postgres://postgres:postgres@db:5432/default',
  });
  await c.connect();

  const wsId = '32c2a902-9983-4e13-b6f6-bc96609f8238';
  const schema = 'workspace_306npwj88jcxnl7zwdogk8bw8';

  const ttCols = await c.query(`
    SELECT column_name, data_type 
    FROM information_schema.columns 
    WHERE table_schema = $1 AND table_name = 'taskTarget'
  `, [schema]);
  console.log('taskTarget columns:', ttCols.rows.map(r => r.column_name));

  const sampleTT = await c.query(`SELECT * FROM ${schema}."taskTarget" LIMIT 5`).catch(e => ({ rows: [] }));
  console.log('sample taskTargets:', sampleTT.rows);

  const sampleTasks = await c.query(`SELECT * FROM ${schema}.task LIMIT 5`).catch(e => ({ rows: [] }));
  console.log('sample tasks:', sampleTasks.rows);

  await c.end();
}

inspectTaskTarget().catch(console.error);

