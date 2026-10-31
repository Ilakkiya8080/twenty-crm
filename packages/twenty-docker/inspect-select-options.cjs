const { Client } = require('pg');

async function inspectSelectOptions() {
  const c = new Client({
    connectionString: process.env.PG_DATABASE_URL || 'postgres://postgres:postgres@db:5432/default',
  });
  await c.connect();

  const wsId = '32c2a902-9983-4e13-b6f6-bc96609f8238';
  const schema = 'workspace_306npwj88jcxnl7zwdogk8bw8';

  const om = (await c.query(`SELECT id FROM core."objectMetadata" WHERE "workspaceId" = $1 AND "nameSingular" = 'company'`, [wsId])).rows[0];

  const selects = await c.query(`
    SELECT name, label, type, options, "defaultValue"
    FROM core."fieldMetadata"
    WHERE "workspaceId" = $1 AND "objectMetadataId" = $2 AND name IN ('propertyType', 'listingType', 'areaUnit', 'propertyStatus')
  `, [wsId, om.id]);

  console.log('Select options on company:');
  selects.rows.forEach(r => {
    console.log(`\nField: ${r.name} (${r.label})`);
    console.log('Default:', r.defaultValue);
    console.log('Options:', r.options);
  });

  const sampleProps = await c.query(`
    SELECT id, name, "propertyId", "propertyType", "listingType", "priceAmountMicros", "priceCurrencyCode", bedrooms, bathrooms, "builtUpArea", "areaUnit", "propertyAddress", city, "propertyStatus", "accountOwnerId"
    FROM ${schema}.company
    ORDER BY "propertyId" ASC NULLS LAST
  `);
  console.log('\nSample Properties in DB:');
  sampleProps.rows.forEach(p => console.log(p));

  await c.end();
}

inspectSelectOptions().catch(console.error);

