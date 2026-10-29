const { Client } = require('pg');

async function checkWs() {
  const c = new Client({
    connectionString: process.env.PG_DATABASE_URL || 'postgres://twenty:twenty@db:5432/default',
  });
  await c.connect();

  const wsId = '7086c87c-730c-48d3-aaea-86d39518ca58';
  const ws = await c.query('SELECT * FROM core.workspace WHERE id = $1', [wsId]);
  console.log('Workspace:', ws.rows[0]);

  const objs = await c.query('SELECT id, "nameSingular", "labelSingular", "labelPlural", "isActive" FROM core."objectMetadata" WHERE "workspaceId" = $1', [wsId]);
  console.log('Objects in this workspace:');
  objs.rows.forEach(o => console.log(`  ${o.nameSingular} -> "${o.labelPlural}" (active: ${o.isActive})`));

  const navs = await c.query('SELECT n.position, n.name, n.icon, o."nameSingular" FROM core."navigationMenuItem" n LEFT JOIN core."objectMetadata" o ON n."targetObjectMetadataId" = o.id WHERE n."workspaceId" = $1 ORDER BY n.position', [wsId]);
  console.log('Navs in this workspace:');
  navs.rows.forEach(n => console.log(`  ${n.position}: ${n.name || n.nameSingular} (${n.icon})`));

  await c.end();
}

checkWs().catch(console.error);
