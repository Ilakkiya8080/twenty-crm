const { Client } = require('pg');

async function run() {
  const c = new Client({ connectionString: process.env.PG_DATABASE_URL || 'postgres://postgres:postgres@db:5432/default' });
  await c.connect();

  const views = await c.query(`
    SELECT v.id, v.name, v.type, v."key", v."position", om."nameSingular" as object_name
    FROM core."view" v
    JOIN core."objectMetadata" om ON v."objectMetadataId" = om.id
    WHERE v."workspaceId" = '32c2a902-9983-4e13-b6f6-bc96609f8238'
    ORDER BY om."nameSingular", v."position";
  `);
  console.log('Views for current workspace:');
  console.table(views.rows);

  await c.end();
}

run().catch(console.error);

