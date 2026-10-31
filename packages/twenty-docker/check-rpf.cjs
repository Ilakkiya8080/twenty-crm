const { Client } = require('pg');

async function run() {
  const client = new Client({ connectionString: process.env.PG_DATABASE_URL || 'postgres://postgres:postgres@db:5432/default' });
  await client.connect();

  const wsId = '32c2a902-9983-4e13-b6f6-bc96609f8238';

  // Check rolePermissionFlag for Admin role
  const rpf = await client.query(`
    SELECT rpf.*, pf.key, pf."universalIdentifier" as pf_ui
    FROM core."rolePermissionFlag" rpf
    JOIN core."permissionFlag" pf ON rpf."permissionFlagId" = pf.id
    WHERE rpf."workspaceId" = $1;
  `, [wsId]);
  console.log('rolePermissionFlag rows:');
  console.table(rpf.rows);

  // Check all permissionFlag definitions
  const allPf = await client.query(`SELECT id, key, "universalIdentifier" FROM core."permissionFlag"`);
  console.log('All permission flags:');
  console.table(allPf.rows);

  // Check roles in workspace
  const roles = await client.query(`SELECT id, label, "canUpdateAllSettings", "canUpdateAllObjectRecords" FROM core.role WHERE "workspaceId" = $1`, [wsId]);
  console.log('Roles:');
  console.table(roles.rows);

  await client.end();
}

run().catch(console.error);

