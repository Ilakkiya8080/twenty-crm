const { Client } = require('pg');

async function run() {
  const c = new Client({ connectionString: process.env.PG_DATABASE_URL || 'postgres://postgres:postgres@db:5432/default' });
  await c.connect();

  const vfs = await c.query(`
    SELECT vf.id, vf."viewId", v.name as view_name, v.type as view_type, vf."fieldMetadataId", f.name as field_name, f.label as field_label, vf.position, vf."isVisible", vf.size
    FROM core."viewField" vf
    JOIN core."view" v ON vf."viewId" = v.id
    JOIN core."fieldMetadata" f ON vf."fieldMetadataId" = f.id
    WHERE vf."viewId" IN ('3ba023cc-ed9c-4ebe-888c-561424e7e3eb', '7d9fac2a-695c-4899-bcce-d565e50ee477')
    ORDER BY vf."viewId", vf.position;
  `);
  console.log(`ViewFields count: ${vfs.rows.length}`);
  console.table(vfs.rows);

  await c.end();
}

run().catch(console.error);

