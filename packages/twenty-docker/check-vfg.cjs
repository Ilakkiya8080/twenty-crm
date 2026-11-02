const { Client } = require('pg');

async function run() {
  const c = new Client({ connectionString: process.env.PG_DATABASE_URL || 'postgres://postgres:postgres@db:5432/default' });
  await c.connect();

  const vfGroups = await c.query(`
    SELECT vfg.id, vfg.name, vfg.position, vfg."viewId", v.name as view_name
    FROM core."viewFieldGroup" vfg
    JOIN core."view" v ON vfg."viewId" = v.id
    WHERE v."workspaceId" = '32c2a902-9983-4e13-b6f6-bc96609f8238'
    ORDER BY vfg."viewId", vfg.position;
  `);
  console.log('ViewFieldGroups in active workspace:');
  console.table(vfGroups.rows);

  // Check which viewFieldGroups are in Company Record Page Fields vs Person Record Page Fields
  const compVfs = await c.query(`
    SELECT vf.id, f.name, f.label, vf."viewFieldGroupId", vfg.name as group_name
    FROM core."viewField" vf
    JOIN core."fieldMetadata" f ON vf."fieldMetadataId" = f.id
    LEFT JOIN core."viewFieldGroup" vfg ON vf."viewFieldGroupId" = vfg.id
    WHERE vf."viewId" = '741024a5-467b-4293-9438-8cb9e29282f8'
    ORDER BY vf.position;
  `);
  console.log('\nCompany Record Page Fields:');
  console.table(compVfs.rows);

  await c.end();
}

run().catch(console.error);

