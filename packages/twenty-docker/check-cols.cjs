const { Client } = require('pg');

async function checkCols() {
  const c = new Client({
    connectionString: process.env.PG_DATABASE_URL || 'postgres://twenty:twenty@db:5432/default',
  });
  await c.connect();

  const dbSchema = 'workspace_6ntqumx3qx41obcdir475foew';
  const tables = ['company', 'person', 'opportunity', 'task', 'note', 'dashboard'];
  for (const t of tables) {
    const cols = await c.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_schema = $1 AND table_name = $2
    `, [dbSchema, t]);
    console.log(`Table ${t} required columns:`, cols.rows.filter(r => r.is_nullable === 'NO').map(r => r.column_name));
  }

  await c.end();
}

checkCols().catch(console.error);
