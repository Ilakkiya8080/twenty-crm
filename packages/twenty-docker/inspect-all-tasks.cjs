const { Client } = require('pg');

async function inspectAllTasks() {
  const c = new Client({
    connectionString: process.env.PG_DATABASE_URL || 'postgres://postgres:postgres@db:5432/default',
  });
  await c.connect();

  const schema = 'workspace_306npwj88jcxnl7zwdogk8bw8';

  const tasks = await c.query(`
    SELECT t.id, t.title, t."dueAt", t.status, tt."targetPersonId", tt."targetOpportunityId", tt."targetCompanyId"
    FROM ${schema}.task t
    LEFT JOIN ${schema}."taskTarget" tt ON tt."taskId" = t.id
  `);
  console.log('All Tasks in DB:', tasks.rows);

  await c.end();
}

inspectAllTasks().catch(console.error);

