const { Client } = require('pg');

async function run() {
  const c = new Client({ connectionString: process.env.PG_DATABASE_URL || 'postgres://postgres:postgres@db:5432/default' });
  await c.connect();

  // Check how viewField is fetched in twenty:
  // Let's check viewFields for 3ba023cc-ed9c-4ebe-888c-561424e7e3eb
  const res = await c.query(`
    SELECT vf.id, vf.position, vf."isVisible", vf.size, vf."fieldMetadataId", f.name, f.label, vf."deletedAt"
    FROM core."viewField" vf
    LEFT JOIN core."fieldMetadata" f ON vf."fieldMetadataId" = f.id
    WHERE vf."viewId" = '3ba023cc-ed9c-4ebe-888c-561424e7e3eb'
    ORDER BY vf.position;
  `);
  console.log('viewFields count in core.viewField:', res.rows.length);
  console.table(res.rows);

  await c.end();
}

run().catch(console.error);

