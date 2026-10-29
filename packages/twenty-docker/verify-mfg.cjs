const { Client } = require('pg');

async function verify() {
  const c = new Client({
    connectionString: process.env.PG_DATABASE_URL || 'postgres://twenty:twenty@db:5432/default',
  });
  await c.connect();

  const ws = (await c.query(`SELECT id, "displayName", "databaseSchema" FROM core.workspace WHERE "deletedAt" IS NULL ORDER BY "createdAt" DESC LIMIT 1`)).rows[0];
  console.log('Active Workspace:', ws);

  const navs = await c.query(`
    SELECT n.position, n.name, n.icon, n.color, o."nameSingular", o."labelPlural"
    FROM core."navigationMenuItem" n
    LEFT JOIN core."objectMetadata" o ON n."targetObjectMetadataId" = o.id
    WHERE n."workspaceId" = $1
    ORDER BY n.position;
  `, [ws.id]);
  console.log('\n--- Navigation Menu Items (Workspace Sidebar) ---');
  navs.rows.forEach(n => console.log(`[${n.position}] ${n.name} | Icon: ${n.icon} | Color: ${n.color} | Target: ${n.nameSingular} ("${n.labelPlural}")`));

  const schema = ws.databaseSchema;
  const compCount = await c.query(`SELECT count(*)::int as cnt FROM ${schema}.company`);
  const prdCount = await c.query(`SELECT count(*)::int as cnt FROM ${schema}.person`);
  const oppCount = await c.query(`SELECT count(*)::int as cnt FROM ${schema}.opportunity`);
  const taskCount = await c.query(`SELECT count(*)::int as cnt FROM ${schema}.task`);
  const noteCount = await c.query(`SELECT count(*)::int as cnt FROM ${schema}.note`);
  const dashCount = await c.query(`SELECT count(*)::int as cnt FROM ${schema}.dashboard`);

  console.log('\n--- Record Counts in Schema ---');
  console.log(`Suppliers (company): ${compCount.rows[0].cnt}`);
  console.log(`Products (person): ${prdCount.rows[0].cnt}`);
  console.log(`Production Orders (opportunity): ${oppCount.rows[0].cnt}`);
  console.log(`Raw Materials (task): ${taskCount.rows[0].cnt}`);
  console.log(`Inventory Items (note): ${noteCount.rows[0].cnt}`);
  console.log(`Quality Reports (dashboard): ${dashCount.rows[0].cnt}`);

  const samplePrds = await c.query(`SELECT "nameFirstName", "nameLastName", "emailsPrimaryEmail", "phonesPrimaryPhoneNumber" FROM ${schema}.person LIMIT 3`);
  console.log('\n--- Sample Products ---', samplePrds.rows);

  const sampleOrders = await c.query(`SELECT name, stage, "amountAmountMicros" FROM ${schema}.opportunity LIMIT 3`);
  console.log('\n--- Sample Production Orders ---', sampleOrders.rows);

  const sampleSuppliers = await c.query(`SELECT name, "domainNamePrimaryLinkLabel", "addressAddressCity" FROM ${schema}.company LIMIT 3`);
  console.log('\n--- Sample Suppliers ---', sampleSuppliers.rows);

  const kanban = await c.query(`
    SELECT v.id, v.name, v.type, vg."fieldValue", vg.position
    FROM core."view" v
    LEFT JOIN core."viewGroup" vg ON vg."viewId" = v.id
    WHERE v."workspaceId" = $1 AND v.type = 'KANBAN'
    ORDER BY vg.position;
  `, [ws.id]);
  console.log('\n--- Production Orders Kanban Pipeline ---', kanban.rows);

  await c.end();
}

verify().catch(console.error);
