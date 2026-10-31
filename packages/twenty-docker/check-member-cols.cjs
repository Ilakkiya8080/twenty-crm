const { Client } = require('pg');

async function run() {
  const client = new Client({ connectionString: process.env.PG_DATABASE_URL || 'postgres://postgres:postgres@db:5432/default' });
  await client.connect();

  const ws = await client.query(`SELECT id, "databaseSchema" FROM core.workspace WHERE id = '32c2a902-9983-4e13-b6f6-bc96609f8238'`);
  const schema = ws.rows[0].databaseSchema;

  const cols = await client.query(`
    SELECT column_name, is_nullable, data_type 
    FROM information_schema.columns 
    WHERE table_schema = $1 AND table_name = 'workspaceMember'
    ORDER BY ordinal_position;
  `, [schema]);
  console.table(cols.rows);

  await client.end();
}

run().catch(console.error);

