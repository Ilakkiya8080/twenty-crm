const { Client } = require('pg');

async function inspectTaskViews() {
  const c = new Client({
    connectionString: process.env.PG_DATABASE_URL || 'postgres://postgres:postgres@db:5432/default',
  });
  await c.connect();

  const wsId = '32c2a902-9983-4e13-b6f6-bc96609f8238';
  const taskId = '2810523d-e043-441e-8963-357c7efda407';

  const views = await c.query(`SELECT id, name, type, key FROM core.view WHERE "workspaceId" = $1 AND "objectMetadataId" = $2`, [wsId, taskId]);
  for (const v of views.rows) {
    console.log(`\nView: ${v.name} (${v.type}, key: ${v.key}) ID: ${v.id}`);
    const groups = await c.query(`SELECT id, name, position FROM core."viewFieldGroup" WHERE "viewId" = $1 ORDER BY position`, [v.id]);
    for (const g of groups.rows) {
      console.log(`  Group: ${g.name}`);
      const vfs = await c.query(`
        SELECT vf.position, fm.name, fm.label 
        FROM core."viewField" vf 
        JOIN core."fieldMetadata" fm ON fm.id = vf."fieldMetadataId" 
        WHERE vf."viewFieldGroupId" = $1 
        ORDER BY vf.position
      `, [g.id]);
      vfs.rows.forEach(vf => console.log(`    - [Pos ${vf.position}] ${vf.label} (${vf.name})`));
    }
    const unassignedVfs = await c.query(`
      SELECT vf.position, fm.name, fm.label, vf."isVisible"
      FROM core."viewField" vf 
      JOIN core."fieldMetadata" fm ON fm.id = vf."fieldMetadataId" 
      WHERE vf."viewId" = $1 AND vf."viewFieldGroupId" IS NULL
      ORDER BY vf.position
    `, [v.id]);
    if (unassignedVfs.rows.length > 0) {
      console.log(`  Ungrouped fields (e.g. table cols):`);
      unassignedVfs.rows.forEach(vf => console.log(`    - [Pos ${vf.position}] ${vf.label} (${vf.name}) visible: ${vf.isVisible}`));
    }
  }

  await c.end();
}

inspectTaskViews().catch(console.error);

