const { Client } = require('pg');

async function checkPerson() {
  const c = new Client(process.env.PG_DATABASE_URL || 'postgres://postgres:postgres@db:5432/default');
  await c.connect();
  const res = await c.query("SELECT column_name FROM information_schema.columns WHERE table_name = 'person' AND table_schema = 'workspace_in88dw8je22da7wpfjhlzhd1'");
  console.log('person columns:', res.rows.map(r => r.column_name));
  await c.end();
}

checkPerson().catch(console.error);
