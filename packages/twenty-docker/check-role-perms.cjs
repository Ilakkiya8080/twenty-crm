const { Client } = require('pg');

async function run() {
  const client = new Client({ connectionString: process.env.PG_DATABASE_URL || 'postgres://postgres:postgres@db:5432/default' });
  await client.connect();

  const wsId = '32c2a902-9983-4e13-b6f6-bc96609f8238';

  const roles = await client.query(`SELECT * FROM core.role WHERE "workspaceId" = $1`, [wsId]);
  console.log('Roles:');
  console.table(roles.rows);

  const roleTargets = await client.query(`
    SELECT rt.id, rt."roleId", rt."userWorkspaceId", r.label AS role_label
    FROM core."roleTarget" rt
    JOIN core.role r ON rt."roleId" = r.id
    WHERE rt."workspaceId" = $1;
  `, [wsId]);
  console.log('Role Targets:');
  console.table(roleTargets.rows);

  // Check if roleObjectPermission or similar table exists
  const tables = await client.query(`
    SELECT table_name FROM information_schema.tables 
    WHERE table_schema = 'core' AND table_name ILIKE '%role%' OR table_name ILIKE '%permission%';
  `);
  console.log('Role/Permission tables:');
  console.table(tables.rows);

  await client.end();
}

run().catch(console.error);

