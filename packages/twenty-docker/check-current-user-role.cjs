const { Client } = require('pg');

async function run() {
  const client = new Client({ connectionString: process.env.PG_DATABASE_URL || 'postgres://postgres:postgres@db:5432/default' });
  await client.connect();

  const wsId = '32c2a902-9983-4e13-b6f6-bc96609f8238';

  const uws = await client.query(`
    SELECT uw.id, uw."userId", u.email, u."firstName", u."lastName",
           rt.id as role_target_id, r.id as role_id, r.label as role_label,
           r."canUpdateAllSettings", r."canUpdateAllObjectRecords"
    FROM core."userWorkspace" uw
    JOIN core."user" u ON uw."userId" = u.id
    LEFT JOIN core."roleTarget" rt ON rt."userWorkspaceId" = uw.id
    LEFT JOIN core.role r ON rt."roleId" = r.id
    WHERE uw."workspaceId" = $1;
  `, [wsId]);
  console.log('Users in workspace:');
  console.table(uws.rows);

  await client.end();
}

run().catch(console.error);

