const { Client } = require('pg');

async function run() {
  const client = new Client({ connectionString: process.env.PG_DATABASE_URL || 'postgres://postgres:postgres@db:5432/default' });
  await client.connect();

  const ws = await client.query(`SELECT id, "databaseSchema" FROM core.workspace WHERE id = '32c2a902-9983-4e13-b6f6-bc96609f8238'`);
  const schema = ws.rows[0].databaseSchema;

  const members = await client.query(`SELECT * FROM ${schema}."workspaceMember"`);
  console.log('Workspace members count:', members.rows.length);
  console.table(members.rows.map(m => ({
    id: m.id,
    nameFirstName: m.nameFirstName,
    nameLastName: m.nameLastName,
    userEmail: m.userEmail,
    jobTitle: m.jobTitle,
    userId: m.userId
  })));

  const leadsAgents = await client.query(`SELECT DISTINCT "assignedAgentId" FROM ${schema}.person WHERE "assignedAgentId" IS NOT NULL`);
  console.log('Distinct assignedAgentId in person:', leadsAgents.rows);

  const compOwners = await client.query(`SELECT DISTINCT "accountOwnerId" FROM ${schema}.company WHERE "accountOwnerId" IS NOT NULL`);
  console.log('Distinct accountOwnerId in company:', compOwners.rows);

  await client.end();
}

run().catch(console.error);

