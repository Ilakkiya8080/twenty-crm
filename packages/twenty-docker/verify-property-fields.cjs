const { Client } = require('pg');

async function main() {
  const c = new Client({ connectionString: process.env.PG_DATABASE_URL || 'postgres://postgres:postgres@db:5432/default' });
  await c.connect();

  const ws = await c.query(`SELECT "databaseSchema" FROM core.workspace WHERE id = '32c2a902-9983-4e13-b6f6-bc96609f8238'`);
  const schema = ws.rows[0].databaseSchema;

  console.log('=== VERIFYING VIEW FIELDS IN ALL PROPERTY LISTINGS ===');
  const vf = await c.query(`
    SELECT vf.position, fm.name, fm.label, fm.type, vf."isVisible", vf.size
    FROM core."viewField" vf
    JOIN core."fieldMetadata" fm ON vf."fieldMetadataId" = fm.id
    WHERE vf."viewId" = '183ac3fd-8e1f-4ba8-9a06-62adab90e9b9' AND vf."isVisible" = true
    ORDER BY vf.position ASC
  `);
  console.table(vf.rows);

  console.log('=== VERIFYING SEEDED PROPERTY LISTINGS DATA ===');
  const props = await c.query(`
    SELECT "propertyId", name, "propertyType", "listingType", "priceAmountMicros" / 1000000 as price, bedrooms, bathrooms, "builtUpArea", "areaUnit", "propertyAddress", city, "propertyStatus"
    FROM ${schema}.company
    ORDER BY "propertyId" ASC
  `);
  console.table(props.rows);

  await c.end();
}

main().catch(console.error);

