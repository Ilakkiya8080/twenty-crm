const { Client } = require('pg');

async function run() {
  const c = new Client({ connectionString: process.env.PG_DATABASE_URL || 'postgres://postgres:postgres@db:5432/default' });
  await c.connect();

  const cols = await c.query(`
    SELECT column_name FROM information_schema.columns WHERE table_schema = 'core' AND table_name = 'viewField';
  `);
  console.log('viewField columns:', cols.rows.map(r => r.column_name).join(', '));

  const vfs = await c.query(`
    SELECT vf.*, f.name as field_name, f.label as field_label
    FROM core."viewField" vf
    JOIN core."fieldMetadata" f ON vf."fieldMetadataId" = f.id
    WHERE vf."viewId" = '3ba023cc-ed9c-4ebe-888c-561424e7e3eb'
    ORDER BY vf.position;
  `);
  console.log('Records for 3ba023cc-ed9c-4ebe-888c-561424e7e3eb:');
  console.table(vfs.rows);

  // Compare with company view fields!
  const compVfs = await c.query(`
    SELECT vf.*, f.name as field_name, f.label as field_label
    FROM core."viewField" vf
    JOIN core."fieldMetadata" f ON vf."fieldMetadataId" = f.id
    JOIN core."view" v ON vf."viewId" = v.id
    WHERE v."name" LIKE '%Property%' AND v.type = 'TABLE'
    ORDER BY vf.position;
  `);
  console.log('Records for Property Listings viewFields:');
  console.table(compVfs.rows);

  await c.end();
}

run().catch(console.error);

