const { Client } = require('pg');

async function run() {
  const c = new Client({ connectionString: process.env.PG_DATABASE_URL || 'postgres://postgres:postgres@db:5432/default' });
  await c.connect();

  const views = await c.query(`
    SELECT v.id, v.name, v.type, v."key"
    FROM core."view" v
    JOIN core."objectMetadata" om ON v."objectMetadataId" = om.id
    WHERE v."workspaceId" = '32c2a902-9983-4e13-b6f6-bc96609f8238' AND om."nameSingular" = 'person';
  `);

  for (const v of views.rows) {
    const vfs = await c.query(`
      SELECT vf.position, vf."isVisible", vf.size, f.name, f.label
      FROM core."viewField" vf
      JOIN core."fieldMetadata" f ON vf."fieldMetadataId" = f.id
      WHERE vf."viewId" = $1
      ORDER BY vf.position;
    `, [v.id]);
    console.log(`\nView "${v.name}" (${v.type}) [${v.id}]: ${vfs.rows.length} fields`);
    console.table(vfs.rows);
  }

  await c.end();
}

run().catch(console.error);

