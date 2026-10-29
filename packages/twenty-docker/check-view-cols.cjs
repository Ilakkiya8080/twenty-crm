const { Client } = require('pg');

async function checkCols() {
  const c = new Client(process.env.PG_DATABASE_URL || 'postgres://postgres:postgres@db:5432/default');
  await c.connect();
  const res = await c.query("SELECT column_name, is_nullable, column_default FROM information_schema.columns WHERE table_schema = 'core' AND table_name = 'view'");
  console.log('core.view columns:');
  for (const r of res.rows) {
    if (r.is_nullable === 'NO') {
      console.log(`REQUIRED: ${r.column_name} (default: ${r.column_default})`);
    }
  }
  await c.end();
}

checkCols().catch(console.error);
