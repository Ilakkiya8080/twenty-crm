const { Client } = require('pg');

async function run() {
  const c = new Client({ connectionString: process.env.PG_DATABASE_URL || 'postgres://postgres:postgres@db:5432/default' });
  await c.connect();

  const vf = await c.query(`
    SELECT vf.id, vf."fieldMetadataId", vf."position", vf."isVisible", vf."size", f.name, f.label, f.type
    FROM core."viewField" vf
    JOIN core."fieldMetadata" f ON vf."fieldMetadataId" = f.id
    WHERE vf."viewId" = '3ba023cc-ed9c-4ebe-888c-561424e7e3eb'
    ORDER BY vf."position" ASC;
  `);
  console.log('Current view fields for "All Buyers & Leads":');
  console.table(vf.rows);

  await c.end();
}

run().catch(console.error);

