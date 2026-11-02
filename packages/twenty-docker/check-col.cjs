const { Client } = require('pg');

async function checkCol() {
  const c = new Client({
    connectionString: process.env.PG_DATABASE_URL || 'postgres://postgres:postgres@db:5432/default',
  });
  await c.connect();

  const res = await c.query(`
    SELECT column_name, data_type 
    FROM information_schema.columns 
    WHERE table_schema = 'core' AND table_name = 'fieldMetadata' AND column_name = 'defaultValue'
  `);
  console.log('defaultValue col type:', res.rows);

  const stageVal = await c.query(`SELECT "defaultValue" FROM core."fieldMetadata" WHERE name = 'stage' LIMIT 1`);
  console.log('stage defaultValue sample:', typeof stageVal.rows[0].defaultValue, stageVal.rows[0].defaultValue);

  await c.end();
}

checkCol().catch(console.error);

