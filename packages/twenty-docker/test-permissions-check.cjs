const { Client } = require('pg');

async function run() {
  const c = new Client({ connectionString: process.env.PG_DATABASE_URL || 'postgres://postgres:postgres@db:5432/default' });
  await c.connect();

  const wsId = '32c2a902-9983-4e13-b6f6-bc96609f8238';

  // 1. Get workspaceMember objectMetadata
  const om = await c.query(`SELECT * FROM core."objectMetadata" WHERE "workspaceId" = $1 AND "nameSingular" = 'workspaceMember'`, [wsId]);
  console.log('ObjectMetadata writability:', om.rows[0].writability, 'applicationId:', om.rows[0].applicationId);

  // 2. Check all fields where writability != 'OPEN'
  const notOpen = await c.query(`
    SELECT name, type, writability, "isSystem"
    FROM core."fieldMetadata"
    WHERE "objectMetadataId" = $1 AND writability != 'OPEN';
  `, [om.rows[0].id]);
  console.log('Fields with writability != OPEN:');
  console.table(notOpen.rows);

  // 3. Check role permissions in core
  const role = await c.query(`
    SELECT r.* FROM core.role r
    JOIN core."roleTarget" rt ON rt."roleId" = r.id
    JOIN core."userWorkspace" uw ON rt."userWorkspaceId" = uw.id
    WHERE uw."workspaceId" = $1 AND uw."userId" = '268f748a-fb33-4724-b213-ea110045f947';
  `, [wsId]);
  console.log('Admin user role in DB:');
  console.table(role.rows);

  // 4. Check core."objectPermission" for workspaceMember
  const objPerm = await c.query(`
    SELECT * FROM core."objectPermission" WHERE "workspaceId" = $1 AND "objectMetadataId" = $2;
  `, [wsId, om.rows[0].id]);
  console.log('ObjectPermission for workspaceMember:', objPerm.rows);

  await c.end();
}

run().catch(console.error);

