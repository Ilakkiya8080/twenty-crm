const { Client } = require('pg');

async function checkVFGsActive() {
  const c = new Client({
    connectionString: process.env.PG_DATABASE_URL || 'postgres://postgres:postgres@db:5432/default',
  });
  await c.connect();

  const vfgs = await c.query(`SELECT id, name, "isVisible", "isActive" FROM core."viewFieldGroup" WHERE "viewId" = '9c821a0b-1ab3-4dee-949d-a8e6027f919e'`);
  console.log('viewFieldGroups:', vfgs.rows);

  const vfs = await c.query(`SELECT id, "fieldMetadataId", "isVisible", "isActive" FROM core."viewField" WHERE "viewId" = '9c821a0b-1ab3-4dee-949d-a8e6027f919e' LIMIT 5`);
  console.log('viewFields in FIELDS_WIDGET:', vfs.rows);

  const tableVfs = await c.query(`SELECT id, "fieldMetadataId", "isVisible", "isActive" FROM core."viewField" WHERE "viewId" = '3193249a-407b-45d2-9e62-82753ef22bb0' LIMIT 5`);
  console.log('viewFields in TABLE:', tableVfs.rows);

  await c.end();
}

checkVFGsActive().catch(console.error);

