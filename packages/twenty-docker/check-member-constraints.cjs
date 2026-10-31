const { Client } = require('pg');

async function run() {
  const client = new Client({ connectionString: process.env.PG_DATABASE_URL || 'postgres://postgres:postgres@db:5432/default' });
  await client.connect();

  const ws = await client.query(`SELECT id, "databaseSchema" FROM core.workspace WHERE id = '32c2a902-9983-4e13-b6f6-bc96609f8238'`);
  const schema = ws.rows[0].databaseSchema;

  const fks = await client.query(`
    SELECT
      tc.table_name, kcu.column_name, 
      ccu.table_schema AS foreign_table_schema,
      ccu.table_name AS foreign_table_name,
      ccu.column_name AS foreign_column_name 
    FROM information_schema.table_constraints AS tc 
    JOIN information_schema.key_column_usage AS kcu
      ON tc.constraint_name = kcu.constraint_name
      AND tc.table_schema = kcu.table_schema
    JOIN information_schema.constraint_column_usage AS ccu
      ON ccu.constraint_name = tc.constraint_name
      AND ccu.table_schema = tc.table_schema
    WHERE tc.constraint_type = 'FOREIGN KEY' AND tc.table_schema = $1 AND tc.table_name = 'workspaceMember';
  `, [schema]);
  console.log('Foreign keys on workspaceMember:');
  console.table(fks.rows);

  const defaults = await client.query(`
    SELECT column_name, column_default, is_nullable
    FROM information_schema.columns
    WHERE table_schema = $1 AND table_name = 'workspaceMember';
  `, [schema]);
  console.log('Columns on workspaceMember:');
  console.table(defaults.rows);

  await client.end();
}

run().catch(console.error);

