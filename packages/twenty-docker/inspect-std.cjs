const { Client } = require('pg');

async function inspectStd() {
  const c = new Client({
    connectionString: process.env.PG_DATABASE_URL || 'postgres://twenty:twenty@db:5432/default',
  });
  await c.connect();

  const wsId = '7086c87c-730c-48d3-aaea-86d39518ca58';
  const objs = await c.query(`
    SELECT id, "nameSingular", "labelSingular", "labelPlural"
    FROM core."objectMetadata"
    WHERE "workspaceId" = $1 AND "nameSingular" IN ('person', 'opportunity', 'company', 'task', 'note', 'dashboard')
  `, [wsId]);

  for (const o of objs.rows) {
    const fields = await c.query(`
      SELECT name, label, type FROM core."fieldMetadata"
      WHERE "objectMetadataId" = $1
      ORDER BY name
    `, [o.id]);
    console.log(`Fields for ${o.nameSingular} (${o.labelPlural}):`, fields.rows.map(f => `${f.name} ("${f.label}", ${f.type})`).join(', '));
  }

  await c.end();
}

inspectStd().catch(console.error);
