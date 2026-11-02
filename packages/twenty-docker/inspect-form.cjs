const { Client } = require('pg');

async function inspectCreationForm() {
  const c = new Client({
    connectionString: process.env.PG_DATABASE_URL || 'postgres://postgres:postgres@db:5432/default',
  });
  await c.connect();

  const formWidgets = await c.query(`
    SELECT * FROM core."pageLayoutWidget" 
    WHERE "pageLayoutTabId" = 'be7cbf9a-f037-46bf-ae2b-be6ea807f72b'
    ORDER BY position->>'index'
  `);
  console.log('Creation form widgets:', JSON.stringify(formWidgets.rows, null, 2));

  await c.end();
}

inspectCreationForm().catch(console.error);

