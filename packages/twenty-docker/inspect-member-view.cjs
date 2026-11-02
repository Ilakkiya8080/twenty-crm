const { Client } = require('pg');

async function run() {
  const client = new Client({ connectionString: process.env.PG_DATABASE_URL || 'postgres://postgres:postgres@db:5432/default' });
  await client.connect();

  const wsId = '32c2a902-9983-4e13-b6f6-bc96609f8238';

  const views = await client.query(`
    SELECT v.id, v.name, v.key, v.icon, v.type, om."nameSingular"
    FROM core."view" v
    JOIN core."objectMetadata" om ON v."objectMetadataId" = om.id
    WHERE v."workspaceId" = $1 AND om."nameSingular" = 'workspaceMember';
  `, [wsId]);
  console.log('Views for workspaceMember:');
  console.table(views.rows);

  if (views.rows.length > 0) {
    const viewId = views.rows[0].id;
    const vfs = await client.query(`
      SELECT vf.id, vf."fieldMetadataId", fm.name, vf.position, vf."isVisible", vf.size
      FROM core."viewField" vf
      JOIN core."fieldMetadata" fm ON vf."fieldMetadataId" = fm.id
      WHERE vf."viewId" = $1
      ORDER BY vf.position;
    `, [viewId]);
    console.log(`ViewFields for view ${viewId}:`);
    console.table(vfs.rows);
  }

  // Also check existing fields on workspaceMember
  const fields = await client.query(`
    SELECT fm.id, fm.name, fm.type, fm."label"
    FROM core."fieldMetadata" fm
    JOIN core."objectMetadata" om ON fm."objectMetadataId" = om.id
    WHERE om."workspaceId" = $1 AND om."nameSingular" = 'workspaceMember'
    ORDER BY fm.name;
  `, [wsId]);
  console.log('Fields on workspaceMember:');
  console.table(fields.rows);

  await client.end();
}

run().catch(console.error);

