const { Client } = require('pg');

async function run() {
  const c = new Client({ connectionString: process.env.PG_DATABASE_URL || 'postgres://postgres:postgres@db:5432/default' });
  await c.connect();

  const compVF = await c.query(`
    SELECT vf.*, f.name as field_name
    FROM core."viewField" vf
    JOIN core."fieldMetadata" f ON vf."fieldMetadataId" = f.id
    WHERE vf."viewId" = '183ac3fd-8e1f-4ba8-9a06-62adab90e9b9' AND f.name = 'propertyId'
    LIMIT 1;
  `);

  const personVF = await c.query(`
    SELECT vf.*, f.name as field_name
    FROM core."viewField" vf
    JOIN core."fieldMetadata" f ON vf."fieldMetadataId" = f.id
    WHERE vf."viewId" = '3ba023cc-ed9c-4ebe-888c-561424e7e3eb' AND f.name = 'leadId'
    LIMIT 1;
  `);

  console.log('Company propertyId viewField:');
  console.log(compVF.rows[0]);

  console.log('\nPerson leadId viewField:');
  console.log(personVF.rows[0]);

  await c.end();
}

run().catch(console.error);

