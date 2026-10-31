const { Client } = require('pg');

async function inspectTaskMeta() {
  const c = new Client({
    connectionString: process.env.PG_DATABASE_URL || 'postgres://postgres:postgres@db:5432/default',
  });
  await c.connect();

  const wsId = '32c2a902-9983-4e13-b6f6-bc96609f8238';
  const schema = 'workspace_306npwj88jcxnl7zwdogk8bw8';

  const om = await c.query(`
    SELECT id, "nameSingular", "labelIdentifierFieldMetadataId" 
    FROM core."objectMetadata" 
    WHERE "workspaceId" = $1 AND "nameSingular" = 'task'
  `, [wsId]);
  console.log('ObjectMetadata for task:', om.rows[0]);

  if (om.rows[0].labelIdentifierFieldMetadataId) {
    const f = await c.query(`SELECT name, label FROM core."fieldMetadata" WHERE id = $1`, [om.rows[0].labelIdentifierFieldMetadataId]);
    console.log('Label Identifier Field:', f.rows[0]);
  }

  const enumVals = await c.query(`
    SELECT e.enumlabel 
    FROM pg_type t 
    JOIN pg_enum e ON t.oid = e.enumtypid 
    JOIN pg_namespace n ON n.oid = t.typnamespace 
    WHERE t.typname = 'task_status_enum' AND n.nspname = $1
    ORDER BY e.enumsortorder
  `, [schema]);
  console.log('task_status_enum values:', enumVals.rows.map(r => r.enumlabel));

  await c.end();
}

inspectTaskMeta().catch(console.error);

