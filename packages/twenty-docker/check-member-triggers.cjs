const { Client } = require('pg');

async function run() {
  const client = new Client({ connectionString: process.env.PG_DATABASE_URL || 'postgres://postgres:postgres@db:5432/default' });
  await client.connect();

  const ws = await client.query(`SELECT id, "databaseSchema" FROM core.workspace WHERE id = '32c2a902-9983-4e13-b6f6-bc96609f8238'`);
  const schema = ws.rows[0].databaseSchema;

  const triggers = await client.query(`
    SELECT trigger_name, event_manipulation, action_statement, action_timing
    FROM information_schema.triggers
    WHERE event_object_schema = $1 AND event_object_table = 'workspaceMember';
  `, [schema]);
  console.log('Triggers on workspaceMember:');
  console.table(triggers.rows);

  await client.end();
}

run().catch(console.error);

