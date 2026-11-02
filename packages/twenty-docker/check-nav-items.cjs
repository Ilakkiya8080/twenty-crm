const { Client } = require('pg');

async function run() {
  const c = new Client({ connectionString: process.env.PG_DATABASE_URL || 'postgres://postgres:postgres@db:5432/default' });
  await c.connect();

  const res = await c.query(`
    SELECT n.id, n.position, n.name, n.icon, n.color, om."nameSingular", om."labelPlural"
    FROM core."navigationMenuItem" n
    LEFT JOIN core."objectMetadata" om ON n."targetObjectMetadataId" = om.id
    WHERE n."workspaceId" = '32c2a902-9983-4e13-b6f6-bc96609f8238'
    ORDER BY n.position;
  `);
  console.log('Current navigation menu items:');
  console.table(res.rows);

  await c.end();
}

run().catch(console.error);

