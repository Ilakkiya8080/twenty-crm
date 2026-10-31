const { Client } = require('pg');

async function inspectReports() {
  const c = new Client({
    connectionString: process.env.PG_DATABASE_URL || 'postgres://postgres:postgres@db:5432/default',
  });
  await c.connect();

  const wsId = '32c2a902-9983-4e13-b6f6-bc96609f8238';
  const schema = 'workspace_306npwj88jcxnl7zwdogk8bw8';

  // 1. Check navigation menu items
  const navItems = await c.query(`
    SELECT nmi.id, nmi.label, nmi.position, nmi.target, nmi."targetObjectMetadataId", nmi."targetViewId", nmi.icon, om."nameSingular", om."labelSingular"
    FROM core."navigationMenuItem" nmi
    LEFT JOIN core."objectMetadata" om ON om.id = nmi."targetObjectMetadataId"
    WHERE nmi."workspaceId" = $1
    ORDER BY nmi.position
  `, [wsId]);
  console.log('Navigation Menu Items:');
  navItems.rows.forEach(r => console.log(r));

  // 2. Check objects with 'report' or 'analytic' or similar
  const objs = await c.query(`
    SELECT id, "nameSingular", "namePlural", "labelSingular", "labelPlural", "isCustom"
    FROM core."objectMetadata"
    WHERE "workspaceId" = $1 AND ("nameSingular" ILIKE '%report%' OR "labelSingular" ILIKE '%report%' OR "nameSingular" ILIKE '%dashboard%')
  `, [wsId]);
  console.log('\nMatching Objects:', objs.rows);

  // 3. Check twenty-companion or iframe/custom apps if any
  console.log('\nChecking all objects in workspace:');
  const allObjs = await c.query(`
    SELECT id, "nameSingular", "labelSingular", "labelPlural"
    FROM core."objectMetadata"
    WHERE "workspaceId" = $1
    ORDER BY "nameSingular"
  `, [wsId]);
  allObjs.rows.forEach(o => console.log(`  - ${o.nameSingular} ("${o.labelSingular}") ID: ${o.id}`));

  await c.end();
}

inspectReports().catch(console.error);

