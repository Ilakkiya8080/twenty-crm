const { Client } = require('pg');

async function checkStage() {
  const c = new Client({
    connectionString: process.env.PG_DATABASE_URL || 'postgres://postgres:postgres@db:5432/default',
  });
  await c.connect();

  const wsId = '32c2a902-9983-4e13-b6f6-bc96609f8238';
  const schema = 'workspace_306npwj88jcxnl7zwdogk8bw8';

  const stageField = await c.query(`
    SELECT options, "defaultValue" FROM core."fieldMetadata" 
    WHERE "workspaceId" = $1 AND name = 'stage'
  `, [wsId]);
  console.log('Stage options in fieldMetadata:', JSON.stringify(stageField.rows[0], null, 2));

  const enumVals = await c.query(`
    SELECT e.enumlabel 
    FROM pg_type t 
    JOIN pg_enum e ON t.oid = e.enumtypid 
    JOIN pg_namespace n ON n.oid = t.typnamespace 
    WHERE t.typname = 'opportunity_stage_enum' AND n.nspname = $1
    ORDER BY e.enumsortorder
  `, [schema]);
  console.log('Postgres enum values:', enumVals.rows.map(r => r.enumlabel));

  const sampleDeals = await c.query(`SELECT id, name, stage FROM ${schema}.opportunity LIMIT 10`);
  console.log('Sample deals:', sampleDeals.rows);

  await c.end();
}

checkStage().catch(console.error);

