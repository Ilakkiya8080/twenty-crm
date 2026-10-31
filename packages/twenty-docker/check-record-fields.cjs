const { Client } = require('pg');

async function run() {
  const c = new Client({ connectionString: process.env.PG_DATABASE_URL || 'postgres://postgres:postgres@db:5432/default' });
  await c.connect();

  const compFieldsWidget = await c.query(`
    SELECT vf.id, vf.position, vf."isVisible", vf.size, f.name, f.label
    FROM core."viewField" vf
    JOIN core."fieldMetadata" f ON vf."fieldMetadataId" = f.id
    WHERE vf."viewId" = '741024a5-467b-4293-9438-8cb9e29282f8'
    ORDER BY vf.position;
  `);
  console.log('Company Record Page Fields viewFields:');
  console.table(compFieldsWidget.rows);

  const personFieldsWidget = await c.query(`
    SELECT vf.id, vf.position, vf."isVisible", vf.size, f.name, f.label
    FROM core."viewField" vf
    JOIN core."fieldMetadata" f ON vf."fieldMetadataId" = f.id
    WHERE vf."viewId" = '7d9fac2a-695c-4899-bcce-d565e50ee477'
    ORDER BY vf.position;
  `);
  console.log('Person Record Page Fields viewFields:');
  console.table(personFieldsWidget.rows);

  await c.end();
}

run().catch(console.error);

