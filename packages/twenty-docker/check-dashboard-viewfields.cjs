const { Client } = require('pg');

async function checkDashboardViewFields() {
  const c = new Client({
    connectionString: process.env.PG_DATABASE_URL || 'postgres://postgres:postgres@db:5432/default',
  });
  await c.connect();

  const wsId = '32c2a902-9983-4e13-b6f6-bc96609f8238';

  const r = await c.query(`
    SELECT vf.id, vf.position, vf."isVisible", fm.name, fm.label
    FROM core."viewField" vf
    JOIN core."fieldMetadata" fm ON fm.id = vf."fieldMetadataId"
    WHERE vf."viewId" = '8a1b981a-ebbc-4032-a554-7e54133442c3'
    ORDER BY vf.position
  `);
  console.log('Columns in Real Estate Reports & Analytics view:', r.rows);

  await c.end();
}

checkDashboardViewFields().catch(console.error);

