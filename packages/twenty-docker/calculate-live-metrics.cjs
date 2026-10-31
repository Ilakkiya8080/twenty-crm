const { Client } = require('pg');

async function calculateLiveMetrics() {
  const c = new Client({
    connectionString: process.env.PG_DATABASE_URL || 'postgres://postgres:postgres@db:5432/default',
  });
  await c.connect();

  const wsId = '32c2a902-9983-4e13-b6f6-bc96609f8238';
  const schema = 'workspace_306npwj88jcxnl7zwdogk8bw8';

  console.log('=== REAL DATA CALCULATION ACROSS ALL MODULES ===\n');

  // 1. Property Listings (company)
  const propCols = await c.query(`SELECT column_name FROM information_schema.columns WHERE table_schema = $1 AND table_name = 'company'`, [schema]);
  console.log('Company columns:', propCols.rows.map(r => r.column_name));
  const props = await c.query(`SELECT * FROM ${schema}.company`);
  console.log(`Found ${props.rows.length} properties:`);
  props.rows.forEach(p => console.log(`  - ${p.name} | Price: ${p.annualRevenueAmountMicros} | Status/Desc: ${p.domainNamePrimaryLinkLabel || ''}`));

  // 2. Buyers & Leads (person)
  const personCols = await c.query(`SELECT column_name FROM information_schema.columns WHERE table_schema = $1 AND table_name = 'person'`, [schema]);
  console.log('\nPerson columns:', personCols.rows.map(r => r.column_name));
  const persons = await c.query(`SELECT * FROM ${schema}.person`);
  console.log(`Found ${persons.rows.length} persons:`);
  persons.rows.forEach(p => console.log(`  - ${p.nameFirstName} ${p.nameLastName || ''} | Job/Desc: ${p.jobTitle}`));

  // 3. Site Visits (note)
  const notes = await c.query(`SELECT * FROM ${schema}.note WHERE "visitId" IS NOT NULL ORDER BY "visitId"`);
  console.log(`\nFound ${notes.rows.length} site visits:`);
  notes.rows.forEach(n => console.log(`  - ${n.visitId} | Date: ${n.visitDate} | Time: ${n.visitTime} | Status: ${n.visitStatus} | Agent: ${n.assignedAgentId}`));

  // 4. Deals (opportunity)
  const oppCols = await c.query(`SELECT column_name FROM information_schema.columns WHERE table_schema = $1 AND table_name = 'opportunity'`, [schema]);
  console.log('\nOpportunity columns:', oppCols.rows.map(r => r.column_name));
  const opps = await c.query(`SELECT * FROM ${schema}.opportunity ORDER BY "createdAt"`);
  console.log(`\nFound ${opps.rows.length} deals:`);
  opps.rows.forEach(o => console.log(`  - ${o.name} | Stage: ${o.stage} | DealType: ${o.dealType} | Amount: ${o.amountAmountMicros} | Agent/Owner: ${o.ownerId || o.assignedAgentId}`));

  // 5. Follow-ups (task)
  const taskCols = await c.query(`SELECT column_name FROM information_schema.columns WHERE table_schema = $1 AND table_name = 'task'`, [schema]);
  console.log('\nTask columns:', taskCols.rows.map(r => r.column_name));
  const tasks = await c.query(`SELECT * FROM ${schema}.task ORDER BY "createdAt"`);
  console.log(`\nFound ${tasks.rows.length} follow-ups:`);
  tasks.rows.forEach(t => console.log(`  - ${t.title} | Status: ${t.status} | Type: ${t.followUpType} | Due: ${t.dueAt}`));

  // 6. Agents (workspaceMember)
  const members = await c.query(`SELECT id, "nameFirstName", "nameLastName", "userEmail", "jobTitle" FROM ${schema}."workspaceMember"`);
  console.log(`\nFound ${members.rows.length} agents:`);
  members.rows.forEach(m => console.log(`  - ${m.nameFirstName} ${m.nameLastName || ''} (${m.userEmail}) | Job: ${m.jobTitle}`));

  await c.end();
}

calculateLiveMetrics().catch(console.error);

