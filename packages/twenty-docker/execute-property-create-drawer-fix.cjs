const { Client } = require('pg');

async function fixPropertyModule() {
  const c = new Client({
    connectionString: process.env.PG_DATABASE_URL || 'postgres://postgres:postgres@db:5432/default',
  });
  await c.connect();

  const wsId = '32c2a902-9983-4e13-b6f6-bc96609f8238';
  const schema = 'workspace_306npwj88jcxnl7zwdogk8bw8';

  console.log('🚀 Fixing Property Listings Module: + Create Drawer Form, Side Panel, and Views...\n');

  // 1. Applications & Object Metadata
  const stdAppRes = await c.query(`SELECT id FROM core.application WHERE "workspaceId" = $1 AND name = 'Standard' LIMIT 1`, [wsId]);
  const customAppRes = await c.query(`SELECT id FROM core.application WHERE "workspaceId" = $1 AND name = 'Custom' LIMIT 1`, [wsId]);
  const stdAppId = stdAppRes.rows.length > 0 ? stdAppRes.rows[0].id : null;
  const customAppId = customAppRes.rows.length > 0 ? customAppRes.rows[0].id : stdAppId;

  const compObj = (await c.query(`SELECT id FROM core."objectMetadata" WHERE "workspaceId" = $1 AND "nameSingular" = 'company'`, [wsId])).rows[0];
  const compObjId = compObj.id;
  console.log('  ✓ Company (Property Listings) Object ID:', compObjId);

  // 2. Setup Sequence and Trigger for Property ID on company
  console.log('\n⚙️  Setting up Property ID sequence and trigger...');
  await c.query(`
    CREATE SEQUENCE IF NOT EXISTS ${schema}.company_property_id_seq START WITH 110;

    CREATE OR REPLACE FUNCTION ${schema}.company_property_trigger()
    RETURNS TRIGGER AS $$
    BEGIN
      IF NEW."propertyId" IS NULL OR NEW."propertyId" = '' THEN
        NEW."propertyId" := 'PROP-' || nextval('${schema}.company_property_id_seq');
      END IF;
      IF NEW."priceAmountMicros" IS NOT NULL AND NEW."annualRevenueAmountMicros" IS NULL THEN
        NEW."annualRevenueAmountMicros" := NEW."priceAmountMicros";
        NEW."annualRevenueCurrencyCode" := COALESCE(NEW."priceCurrencyCode", 'USD');
      ELSIF NEW."annualRevenueAmountMicros" IS NOT NULL AND NEW."priceAmountMicros" IS NULL THEN
        NEW."priceAmountMicros" := NEW."annualRevenueAmountMicros";
        NEW."priceCurrencyCode" := COALESCE(NEW."annualRevenueCurrencyCode", 'USD');
      END IF;
      RETURN NEW;
    END;
    $$ LANGUAGE plpgsql;

    DROP TRIGGER IF EXISTS trg_company_property_before ON ${schema}.company;
    CREATE TRIGGER trg_company_property_before
    BEFORE INSERT ON ${schema}.company
    FOR EACH ROW EXECUTE FUNCTION ${schema}.company_property_trigger();
  `);
  console.log('  ✓ Property ID sequence and trigger active');

  // 3. Clean up database records
  console.log('\n🧹 Cleaning up company table records...');
  await c.query(`DELETE FROM ${schema}.company WHERE name IS NULL AND "propertyId" IS NULL;`);

  await c.query(`
    UPDATE ${schema}.company
    SET "propertyId" = 'PROP-109',
        "propertyType" = 'PLOT',
        "listingType" = 'SALE',
        "priceAmountMicros" = 350000000000,
        "priceCurrencyCode" = 'USD',
        "annualRevenueAmountMicros" = 350000000000,
        "annualRevenueCurrencyCode" = 'USD',
        "builtUpArea" = 7500,
        "areaUnit" = 'SQ_FT',
        "propertyAddress" = 'Villapuram Scenic Ridge, Plot 4',
        city = 'Madurai',
        "propertyStatus" = 'AVAILABLE',
        name = 'Villapuram Scenic Ridge Plot 4'
    WHERE name = 'villapuam' AND "propertyId" IS NULL;
  `);
  console.log('  ✓ Records cleaned up');

  // 4. Update Field Metadata for Property Listings
  console.log('\n📝 Ensuring all property fields are UI editable and clearly labelled...');
  const fieldUpdates = [
    { name: 'propertyId', label: 'Property ID', icon: 'IconId', isUIEditable: true, isUIReadOnly: false },
    { name: 'name', label: 'Property Name', icon: 'IconBuildingSkyscraper', isUIEditable: true, isUIReadOnly: false },
    { name: 'propertyType', label: 'Property Type', icon: 'IconHome', isUIEditable: true, isUIReadOnly: false },
    { name: 'listingType', label: 'Listing Type', icon: 'IconTag', isUIEditable: true, isUIReadOnly: false },
    { name: 'price', label: 'Price', icon: 'IconCurrencyDollar', isUIEditable: true, isUIReadOnly: false },
    { name: 'bedrooms', label: 'Bedrooms', icon: 'IconBed', isUIEditable: true, isUIReadOnly: false },
    { name: 'bathrooms', label: 'Bathrooms', icon: 'IconBath', isUIEditable: true, isUIReadOnly: false },
    { name: 'builtUpArea', label: 'Built-up Area', icon: 'IconRuler2', isUIEditable: true, isUIReadOnly: false },
    { name: 'areaUnit', label: 'Area Unit', icon: 'IconDimensions', isUIEditable: true, isUIReadOnly: false },
    { name: 'propertyAddress', label: 'Address', icon: 'IconMapPin', isUIEditable: true, isUIReadOnly: false },
    { name: 'city', label: 'City', icon: 'IconBuildingCommunity', isUIEditable: true, isUIReadOnly: false },
    { name: 'propertyStatus', label: 'Property Status', icon: 'IconProgressCheck', isUIEditable: true, isUIReadOnly: false },
    { name: 'accountOwner', label: 'Assigned Agent', icon: 'IconUserCheck', isUIEditable: true, isUIReadOnly: false },
  ];

  for (const f of fieldUpdates) {
    await c.query(`
      UPDATE core."fieldMetadata"
      SET label = $1, icon = $2, "isUIEditable" = $3, "isUIReadOnly" = $4, "isActive" = true, "updatedAt" = NOW()
      WHERE "workspaceId" = $5 AND "objectMetadataId" = $6 AND name = $7
    `, [f.label, f.icon, f.isUIEditable, f.isUIReadOnly, wsId, compObjId, f.name]);
  }

  // Fetch all field IDs on company
  const allFields = await c.query(`SELECT id, name FROM core."fieldMetadata" WHERE "workspaceId" = $1 AND "objectMetadataId" = $2`, [wsId, compObjId]);
  const fMap = {};
  allFields.rows.forEach(r => { fMap[r.name] = r.id; });

  const requiredPropertyFields = [
    'propertyId',
    'name',
    'propertyType',
    'listingType',
    'price',
    'bedrooms',
    'bathrooms',
    'builtUpArea',
    'areaUnit',
    'propertyAddress',
    'city',
    'propertyStatus',
    'accountOwner',
  ];

  console.log('Property Fields Mapping:');
  requiredPropertyFields.forEach(fn => console.log(`  ✓ ${fn}: ${fMap[fn]}`));

  // 5. Configure Creation Form (RECORD_FORM layout - "+ Create" Drawer)
  console.log('\n📋 Configuring Creation Form (RECORD_FORM layout)...');
  const creationLayoutRes = await c.query(`
    SELECT id FROM core."pageLayout"
    WHERE "workspaceId" = $1 AND "objectMetadataId" = $2 AND type = 'RECORD_FORM'
  `, [wsId, compObjId]);

  if (creationLayoutRes.rows.length > 0) {
    const creationLayoutId = creationLayoutRes.rows[0].id;
    const tabRes = await c.query(`SELECT id FROM core."pageLayoutTab" WHERE "pageLayoutId" = $1 LIMIT 1`, [creationLayoutId]);
    if (tabRes.rows.length > 0) {
      const tabId = tabRes.rows[0].id;
      await c.query(`DELETE FROM core."pageLayoutWidget" WHERE "pageLayoutTabId" = $1`, [tabId]);

      for (let i = 0; i < requiredPropertyFields.length; i++) {
        const fn = requiredPropertyFields[i];
        const fId = fMap[fn];
        if (fId) {
          await c.query(`
            INSERT INTO core."pageLayoutWidget" (
              id, "universalIdentifier", "pageLayoutTabId", "workspaceId", "applicationId",
              title, type, "objectMetadataId", "gridPosition", configuration,
              position, "isActive", "isSystemSideEffect", "createdAt", "updatedAt"
            ) VALUES (
              gen_random_uuid(), gen_random_uuid(), $1, $2, $3,
              '', 'FORM_FIELD', $4, $5, $6,
              $7, true, true, NOW(), NOW()
            )
          `, [
            tabId, wsId, stdAppId,
            compObjId,
            JSON.stringify({ row: 0, column: 0, rowSpan: 1, columnSpan: 12 }),
            JSON.stringify({ fieldMetadataId: fId, configurationType: 'FORM_FIELD' }),
            JSON.stringify({ index: i, layoutMode: 'VERTICAL_LIST' }),
          ]);
        }
      }
      console.log('  ✓ Configured 13 FORM_FIELD widgets on Creation Form in order');
    }
  }

  // 6. Configure FIELDS_WIDGET View (Side Panel / Record Page Fields)
  console.log('\n🗂️  Configuring FIELDS_WIDGET View...');
  const fieldsWidgetViewRes = await c.query(`
    SELECT id FROM core.view 
    WHERE "workspaceId" = $1 AND "objectMetadataId" = $2 AND type = 'FIELDS_WIDGET'
  `, [wsId, compObjId]);

  let fwViewId;
  if (fieldsWidgetViewRes.rows.length > 0) {
    fwViewId = fieldsWidgetViewRes.rows[0].id;
  } else {
    const newViewRes = await c.query(`
      INSERT INTO core.view (
        id, "universalIdentifier", name, "objectMetadataId", type, icon, position,
        "isCompact", "isCustom", "openRecordIn", "workspaceId", "applicationId",
        visibility, "isActive", "isSystemSideEffect", "groupLoadLimit", "createdAt", "updatedAt"
      ) VALUES (
        gen_random_uuid(), gen_random_uuid(), 'Company Record Page Fields', $1, 'FIELDS_WIDGET', 'IconListDetails', 0,
        false, false, 'SIDE_PANEL', $2, $3,
        'WORKSPACE', true, true, 8, NOW(), NOW()
      ) RETURNING id;
    `, [compObjId, wsId, stdAppId]);
    fwViewId = newViewRes.rows[0].id;
  }

  await c.query(`DELETE FROM core."viewField" WHERE "viewId" = $1`, [fwViewId]);
  await c.query(`DELETE FROM core."viewFieldGroup" WHERE "viewId" = $1`, [fwViewId]);

  const groupsDef = [
    {
      name: 'Property Details',
      position: 0,
      fields: ['propertyId', 'name', 'propertyType', 'listingType', 'propertyStatus', 'price', 'accountOwner'],
    },
    {
      name: 'Specifications & Size',
      position: 1,
      fields: ['bedrooms', 'bathrooms', 'builtUpArea', 'areaUnit'],
    },
    {
      name: 'Location',
      position: 2,
      fields: ['propertyAddress', 'city'],
    },
    {
      name: 'Associations',
      position: 3,
      fields: ['people', 'opportunities', 'siteVisits', 'followUps'],
    },
    {
      name: 'System',
      position: 4,
      fields: ['createdAt', 'createdBy', 'updatedAt', 'updatedBy'],
    },
  ];

  for (const g of groupsDef) {
    const gRes = await c.query(`
      INSERT INTO core."viewFieldGroup" (
        id, "universalIdentifier", name, position, "isVisible", "isActive",
        "viewId", "workspaceId", "applicationId", "createdAt", "updatedAt"
      ) VALUES (
        gen_random_uuid(), gen_random_uuid(), $1, $2, true, true,
        $3, $4, $5, NOW(), NOW()
      ) RETURNING id;
    `, [g.name, g.position, fwViewId, wsId, stdAppId]);
    const gId = gRes.rows[0].id;

    for (let pos = 0; pos < g.fields.length; pos++) {
      const fn = g.fields[pos];
      const fId = fMap[fn];
      if (fId) {
        await c.query(`
          INSERT INTO core."viewField" (
            id, "universalIdentifier", "viewId", "fieldMetadataId", "viewFieldGroupId",
            position, "isVisible", "isActive", size, "workspaceId", "applicationId",
            "createdAt", "updatedAt"
          ) VALUES (
            gen_random_uuid(), gen_random_uuid(), $1, $2, $3,
            $4, true, true, 200, $5, $6,
            NOW(), NOW()
          )
        `, [fwViewId, fId, gId, pos, wsId, stdAppId]);
      }
    }
  }
  console.log('  ✓ Configured FIELDS_WIDGET View with all 5 property field groups');

  // 7. Configure Table Views (All Property Listings)
  console.log('\n📊 Configuring Table Views for Property Listings...');
  const tableViewsRes = await c.query(`
    SELECT id, name FROM core.view 
    WHERE "workspaceId" = $1 AND "objectMetadataId" = $2 AND type = 'TABLE'
  `, [wsId, compObjId]);

  const tableColSizes = {
    propertyId: 120,
    name: 240,
    propertyType: 130,
    listingType: 120,
    price: 140,
    bedrooms: 100,
    bathrooms: 100,
    builtUpArea: 120,
    areaUnit: 100,
    propertyAddress: 220,
    city: 130,
    propertyStatus: 130,
    accountOwner: 170,
  };

  for (const tv of tableViewsRes.rows) {
    await c.query(`DELETE FROM core."viewField" WHERE "viewId" = $1`, [tv.id]);
    for (let i = 0; i < requiredPropertyFields.length; i++) {
      const fn = requiredPropertyFields[i];
      const fId = fMap[fn];
      const sz = tableColSizes[fn] || 150;
      if (fId) {
        await c.query(`
          INSERT INTO core."viewField" (
            id, "universalIdentifier", "viewId", "fieldMetadataId",
            position, "isVisible", "isActive", size, "workspaceId", "applicationId",
            "createdAt", "updatedAt"
          ) VALUES (
            gen_random_uuid(), gen_random_uuid(), $1, $2,
            $3, true, true, $4, $5, $6,
            NOW(), NOW()
          )
        `, [tv.id, fId, i, sz, wsId, stdAppId]);
      }
    }
    console.log(`  ✓ Synced 13 clean columns to Table View: ${tv.name} (${tv.id})`);
  }

  // 8. Bump Workspace Metadata Cache Version
  await c.query(`UPDATE core.workspace SET "metadataVersion" = "metadataVersion" + 1 WHERE id = $1`, [wsId]);
  console.log('\n✨ Incremented workspace metadataVersion');

  await c.end();
  console.log('\n🎉 Property Listings Module create drawer and views fix complete!');
}

fixPropertyModule().catch(err => {
  console.error('❌ Error executing Property fix:', err);
  process.exit(1);
});

