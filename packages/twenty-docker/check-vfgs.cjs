const { Client } = require('pg');

async function checkVFGs() {
  const c = new Client({
    connectionString: process.env.PG_DATABASE_URL || 'postgres://postgres:postgres@db:5432/default',
  });
  await c.connect();

  const vfgs = await c.query(`SELECT id, name, "isVisible" FROM core."viewFieldGroup" WHERE "viewId" = '9c821a0b-1ab3-4dee-949d-a8e6027f919e'`);
  console.log('viewFieldGroups isVisible:', vfgs.rows);

  await c.end();
}

checkVFGs().catch(console.error);

