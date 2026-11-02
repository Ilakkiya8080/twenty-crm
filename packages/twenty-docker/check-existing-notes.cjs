const { Client } = require('pg');

async function run() {
  const c = new Client({
    connectionString: process.env.PG_DATABASE_URL || 'postgres://postgres:postgres@db:5432/default',
  });
  await c.connect();

  const wsId = '32c2a902-9983-4e13-b6f6-bc96609f8238';
  const schema = 'workspace_306npwj88jcxnl7zwdogk8bw8';

  const notes = await c.query(`SELECT id, title, "bodyV2Markdown" FROM ${schema}.note ORDER BY "createdAt" ASC`);
  console.log(`Found ${notes.rows.length} notes:`);
  for (const n of notes.rows) {
    const targets = await c.query(`SELECT "targetPersonId", "targetCompanyId" FROM ${schema}."noteTarget" WHERE "noteId" = $1`, [n.id]);
    console.log(`ID: ${n.id} | Title: ${n.title} | Targets:`, targets.rows);
    console.log(`Markdown: ${n.bodyV2Markdown}\n---`);
  }

  const agents = await c.query(`SELECT id, "nameFirstName", "nameLastName", "userEmail" FROM ${schema}."workspaceMember"`);
  console.log('Available Agents:', agents.rows);

  await c.end();
}

run().catch(console.error);

