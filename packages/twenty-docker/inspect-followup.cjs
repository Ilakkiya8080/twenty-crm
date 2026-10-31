const { Client } = require('pg');

async function inspectFollowUps() {
  const c = new Client({
    connectionString: process.env.PG_DATABASE_URL || 'postgres://postgres:postgres@db:5432/default',
  });
  await c.connect();

  const wsId = '32c2a902-9983-4e13-b6f6-bc96609f8238';

  const objects = await c.query(`
    SELECT id, "nameSingular", "namePlural", "labelSingular", "labelPlural", "isSystem"
    FROM core."objectMetadata"
    WHERE "workspaceId" = $1
    ORDER BY "nameSingular"
  `, [wsId]);
  console.log('All Objects in Workspace:');
  objects.rows.forEach(o => {
    console.log(`- ${o.nameSingular} (${o.namePlural}) => Label: "${o.labelSingular}" / "${o.labelPlural}" (system: ${o.isSystem}) ID: ${o.id}`);
  });

  const views = await c.query(`
    SELECT id, name, "objectMetadataId", type, key
    FROM core.view
    WHERE "workspaceId" = $1 AND name ILIKE '%follow%'
  `, [wsId]);
  console.log('\nViews with "follow":', views.rows);

  await c.end();
}

inspectFollowUps().catch(console.error);
