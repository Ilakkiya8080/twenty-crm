const { Client } = require('pg');

async function run() {
  const c = new Client({ connectionString: process.env.PG_DATABASE_URL || 'postgres://postgres:postgres@db:5432/default' });
  await c.connect();

  const obj = await c.query(`
    SELECT *
    FROM core."objectMetadata"
    WHERE "workspaceId" = '32c2a902-9983-4e13-b6f6-bc96609f8238' AND "nameSingular" = 'workspaceMember';
  `);
  console.log('workspaceMember objectMetadata:');
  console.log(obj.rows[0]);

  const views = await c.query(`
    SELECT id, name, type, "key", "position"
    FROM core."view"
    WHERE "workspaceId" = '32c2a902-9983-4e13-b6f6-bc96609f8238' AND "objectMetadataId" = $1;
  `, [obj.rows[0].id]);
  console.log('Views for workspaceMember:');
  console.table(views.rows);

  const members = await c.query(`
    SELECT id, "nameFirstName", "nameLastName", "userEmail", "jobTitle"
    FROM workspace_306npwj88jcxnl7zwdogk8bw8."workspaceMember"
    LIMIT 10;
  `);
  console.log('Existing members in workspaceMember table:');
  console.table(members.rows);

  await c.end();
}

run().catch(console.error);

