const { Client } = require('pg');

async function run() {
  const c = new Client({
    connectionString: process.env.PG_DATABASE_URL || 'postgres://postgres:postgres@db:5432/default',
  });
  await c.connect();

  const cols = await c.query(`
    SELECT column_name, data_type 
    FROM information_schema.columns 
    WHERE table_schema = 'core' AND table_name = 'fieldMetadata'
    ORDER BY ordinal_position
  `);
  console.log('Columns in core.fieldMetadata:');
  cols.rows.forEach(r => console.log(`  - ${r.column_name} (${r.data_type})`));

  await c.end();
}

run().catch(console.error);

