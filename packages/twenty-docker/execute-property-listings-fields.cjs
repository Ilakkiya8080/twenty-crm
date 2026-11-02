const { Client } = require('pg');
const { execSync } = require('child_process');

async function provisionPropertyListingsFields() {
  const c = new Client({
    connectionString: process.env.PG_DATABASE_URL || 'postgres://postgres:postgres@db:5432/default',
  });
  await c.connect();

  console.log('🚀 Starting Real Estate Property Listings Field Provisioning...');

  const wsRes = await c.query(`SELECT id, "displayName", "databaseSchema" FROM core.workspace WHERE "deletedAt" IS NULL`);
  if (wsRes.rows.length === 0) {
    throw new Error('No active workspace found');
  }

  for (const ws of wsRes.rows) {
    const wsId = ws.id;
    const dbSchema = ws.databaseSchema;
    console.log(`\n🏢 Processing Workspace: "${ws.displayName}" (${wsId}) [Schema: ${dbSchema}]`);

    // Fetch Application ID
    const appRes = await c.query(`
      SELECT id FROM core.application 
      WHERE "workspaceId" = $1 
      ORDER BY "createdAt" ASC LIMIT 1
    `, [wsId]);
    const appId = appRes.rows[0].id;

    // Fetch Object Metadata ID for company (Property Listings)
    const objRes = await c.query(`
      SELECT id FROM core."objectMetadata" 
      WHERE "workspaceId" = $1 AND "nameSingular" = 'company'
    `, [wsId]);
    if (objRes.rows.length === 0) {
      console.warn('Company object not found in workspace, skipping');
      continue;
    }
    const compObjId = objRes.rows[0].id;

    // Fetch active member ID for assignedAgent
    let defaultMemberId = null;
    if (dbSchema) {
      const memRes = await c.query(`SELECT id FROM ${dbSchema}."workspaceMember" LIMIT 1`).catch(() => ({ rows: [] }));
      if (memRes.rows.length > 0) {
        defaultMemberId = memRes.rows[0].id;
      }
    }

    // 1. Update Existing Standard Fields to Real Estate terminology
    console.log('✏️  Updating existing standard fields...');
    await c.query(`UPDATE core."fieldMetadata" SET label = 'Property ID', icon = 'IconId', description = 'System unique property ID' WHERE "objectMetadataId" = $1 AND name = 'id'`, [compObjId]);
    await c.query(`UPDATE core."fieldMetadata" SET label = 'Property Name', icon = 'IconBuilding', description = 'Headline and property title for marketing and listings' WHERE "objectMetadataId" = $1 AND name = 'name'`, [compObjId]);
    await c.query(`UPDATE core."fieldMetadata" SET label = 'Price', icon = 'IconCurrencyDollar', description = 'Listing price or monthly rental rate' WHERE "objectMetadataId" = $1 AND name = 'annualRevenue'`, [compObjId]);
    await c.query(`UPDATE core."fieldMetadata" SET label = 'Address', icon = 'IconMapPin', description = 'Street address of the property listing' WHERE "objectMetadataId" = $1 AND name = 'address'`, [compObjId]);
    await c.query(`UPDATE core."fieldMetadata" SET label = 'Assigned Agent', icon = 'IconUserCheck', description = 'The real estate agent or broker assigned to this listing' WHERE "objectMetadataId" = $1 AND name = 'accountOwner'`, [compObjId]);

    // 2. Define Custom Fields to add
    const fieldsToCreate = [
      {
        name: 'propertyId',
        label: 'Property ID',
        type: 'TEXT',
        icon: 'IconHash',
        description: 'Auto-generated unique property listing code (e.g. PROP-101)',
        options: null,
      },
      {
        name: 'propertyType',
        label: 'Property Type',
        type: 'SELECT',
        icon: 'IconHome',
        description: 'Select: Apartment, House, Villa, Plot, Commercial',
        options: [
          { id: '70707070-0001-4000-8000-000000000001', color: 'blue', label: 'Apartment', value: 'APARTMENT', position: 0 },
          { id: '70707070-0002-4000-8000-000000000002', color: 'yellow', label: 'House', value: 'HOUSE', position: 1 },
          { id: '70707070-0003-4000-8000-000000000003', color: 'green', label: 'Villa', value: 'VILLA', position: 2 },
          { id: '70707070-0004-4000-8000-000000000004', color: 'orange', label: 'Plot', value: 'PLOT', position: 3 },
          { id: '70707070-0005-4000-8000-000000000005', color: 'purple', label: 'Commercial', value: 'COMMERCIAL', position: 4 },
        ],
      },
      {
        name: 'listingType',
        label: 'Listing Type',
        type: 'SELECT',
        icon: 'IconTag',
        description: 'Select: Sale / Rent',
        options: [
          { id: '70707070-0011-4000-8000-000000000001', color: 'teal', label: 'Sale', value: 'SALE', position: 0 },
          { id: '70707070-0012-4000-8000-000000000002', color: 'blue', label: 'Rent', value: 'RENT', position: 1 },
        ],
      },
      {
        name: 'price',
        label: 'Price',
        type: 'CURRENCY',
        icon: 'IconCurrencyDollar',
        description: 'Listing price or monthly rental rate',
        options: null,
      },
      {
        name: 'bedrooms',
        label: 'Bedrooms',
        type: 'NUMBER',
        icon: 'IconBed',
        description: 'Number of bedrooms',
        options: null,
      },
      {
        name: 'bathrooms',
        label: 'Bathrooms',
        type: 'NUMBER',
        icon: 'IconBath',
        description: 'Number of bathrooms',
        options: null,
      },
      {
        name: 'builtUpArea',
        label: 'Built-up Area',
        type: 'NUMBER',
        icon: 'IconRulerMeasure',
        description: 'Built-up area measurement',
        options: null,
      },
      {
        name: 'areaUnit',
        label: 'Area Unit',
        type: 'SELECT',
        icon: 'IconRuler2',
        description: 'Select: Sq.ft / Sq.m',
        options: [
          { id: '70707070-0021-4000-8000-000000000001', color: 'sky', label: 'Sq.ft', value: 'SQ_FT', position: 0 },
          { id: '70707070-0022-4000-8000-000000000002', color: 'teal', label: 'Sq.m', value: 'SQ_M', position: 1 },
        ],
      },
      {
        name: 'propertyAddress',
        label: 'Address',
        type: 'TEXT',
        icon: 'IconMapPin',
        description: 'Street address',
        options: null,
      },
      {
        name: 'city',
        label: 'City',
        type: 'TEXT',
        icon: 'IconBuildingCommunity',
        description: 'City location',
        options: null,
      },
      {
        name: 'propertyStatus',
        label: 'Property Status',
        type: 'SELECT',
        icon: 'IconProgressCheck',
        description: 'Select: Available / Reserved / Sold / Rented / Inactive',
        options: [
          { id: '70707070-0031-4000-8000-000000000001', color: 'green', label: 'Available', value: 'AVAILABLE', position: 0 },
          { id: '70707070-0032-4000-8000-000000000002', color: 'yellow', label: 'Reserved', value: 'RESERVED', position: 1 },
          { id: '70707070-0033-4000-8000-000000000003', color: 'red', label: 'Sold', value: 'SOLD', position: 2 },
          { id: '70707070-0034-4000-8000-000000000004', color: 'blue', label: 'Rented', value: 'RENTED', position: 3 },
          { id: '70707070-0035-4000-8000-000000000005', color: 'gray', label: 'Inactive', value: 'INACTIVE', position: 4 },
        ],
      },
    ];

    console.log('➕ Registering custom fields in core."fieldMetadata"...');
    for (const f of fieldsToCreate) {
      const existingField = await c.query(`
        SELECT id FROM core."fieldMetadata" 
        WHERE "objectMetadataId" = $1 AND name = $2
      `, [compObjId, f.name]);

      if (existingField.rows.length === 0) {
        await c.query(`
          INSERT INTO core."fieldMetadata" (
            id, "universalIdentifier", "objectMetadataId", "workspaceId", "applicationId",
            name, label, type, icon, description, options, "isActive", "isSystem",
            "isUIEditable", "isUIReadOnly", "isNullable", "isLabelSyncedWithName",
            "isAuditLogged", "isSystemSideEffect", writability, "createdAt", "updatedAt"
          ) VALUES (
            gen_random_uuid(), gen_random_uuid(), $1, $2, $3,
            $4, $5, $6, $7, $8, $9, true, false,
            true, false, true, false,
            true, false, 'OPEN', NOW(), NOW()
          )
        `, [
          compObjId, wsId, appId,
          f.name, f.label, f.type, f.icon, f.description,
          f.options ? JSON.stringify(f.options) : null,
        ]);
        console.log(`   ✓ Added field: ${f.name} (${f.label}) [${f.type}]`);
      } else {
        await c.query(`
          UPDATE core."fieldMetadata"
          SET label = $1, icon = $2, description = $3, options = $4, "isActive" = true, "isUIEditable" = true
          WHERE id = $5
        `, [
          f.label, f.icon, f.description,
          f.options ? JSON.stringify(f.options) : null,
          existingField.rows[0].id
        ]);
        console.log(`   ↺ Updated field: ${f.name} (${f.label}) [${f.type}]`);
      }
    }

    // 3. PostgreSQL Database Schema DDL: Types and Columns
    if (dbSchema) {
      console.log('🛠️  Ensuring PostgreSQL schema enums and columns in ' + dbSchema + '...');
      await c.query(`
        DO $$
        BEGIN
          IF NOT EXISTS (SELECT 1 FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace WHERE t.typname = 'company_propertyType_enum' AND n.nspname = '${dbSchema}') THEN
            CREATE TYPE ${dbSchema}."company_propertyType_enum" AS ENUM ('APARTMENT', 'HOUSE', 'VILLA', 'PLOT', 'COMMERCIAL');
          END IF;

          IF NOT EXISTS (SELECT 1 FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace WHERE t.typname = 'company_listingType_enum' AND n.nspname = '${dbSchema}') THEN
            CREATE TYPE ${dbSchema}."company_listingType_enum" AS ENUM ('SALE', 'RENT');
          END IF;

          IF NOT EXISTS (SELECT 1 FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace WHERE t.typname = 'company_areaUnit_enum' AND n.nspname = '${dbSchema}') THEN
            CREATE TYPE ${dbSchema}."company_areaUnit_enum" AS ENUM ('SQ_FT', 'SQ_M');
          END IF;

          IF NOT EXISTS (SELECT 1 FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace WHERE t.typname = 'company_propertyStatus_enum' AND n.nspname = '${dbSchema}') THEN
            CREATE TYPE ${dbSchema}."company_propertyStatus_enum" AS ENUM ('AVAILABLE', 'RESERVED', 'SOLD', 'RENTED', 'INACTIVE');
          END IF;
        END $$;

        ALTER TABLE ${dbSchema}.company ADD COLUMN IF NOT EXISTS "propertyId" text;
        ALTER TABLE ${dbSchema}.company ADD COLUMN IF NOT EXISTS "propertyType" ${dbSchema}."company_propertyType_enum";
        ALTER TABLE ${dbSchema}.company ADD COLUMN IF NOT EXISTS "listingType" ${dbSchema}."company_listingType_enum";
        ALTER TABLE ${dbSchema}.company ADD COLUMN IF NOT EXISTS "priceAmountMicros" numeric;
        ALTER TABLE ${dbSchema}.company ADD COLUMN IF NOT EXISTS "priceCurrencyCode" text DEFAULT 'USD';
        ALTER TABLE ${dbSchema}.company ADD COLUMN IF NOT EXISTS "bedrooms" double precision;
        ALTER TABLE ${dbSchema}.company ADD COLUMN IF NOT EXISTS "bathrooms" double precision;
        ALTER TABLE ${dbSchema}.company ADD COLUMN IF NOT EXISTS "builtUpArea" double precision;
        ALTER TABLE ${dbSchema}.company ADD COLUMN IF NOT EXISTS "areaUnit" ${dbSchema}."company_areaUnit_enum";
        ALTER TABLE ${dbSchema}.company ADD COLUMN IF NOT EXISTS "propertyAddress" text;
        ALTER TABLE ${dbSchema}.company ADD COLUMN IF NOT EXISTS "city" text;
        ALTER TABLE ${dbSchema}.company ADD COLUMN IF NOT EXISTS "propertyStatus" ${dbSchema}."company_propertyStatus_enum";
      `);

      // 4. Populate Real Estate Property Listings Data
      console.log('🏡 Populating detailed property listings seed data...');
      const propertyData = [
        {
          id: '33333333-0001-4000-8000-000000000001',
          code: 'PROP-101',
          name: 'Skyline Grand Penthouse',
          propertyType: 'VILLA',
          listingType: 'SALE',
          priceMicros: 2450000000000,
          bedrooms: 4,
          bathrooms: 5,
          builtUpArea: 4800,
          areaUnit: 'SQ_FT',
          address: '742 Evergreen Terrace, Floor 42',
          city: 'San Francisco',
          status: 'AVAILABLE',
        },
        {
          id: '33333333-0002-4000-8000-000000000002',
          code: 'PROP-102',
          name: 'Emerald Valley Luxury Villa 4B',
          propertyType: 'VILLA',
          listingType: 'SALE',
          priceMicros: 1650000000000,
          bedrooms: 5,
          bathrooms: 4,
          builtUpArea: 3950,
          areaUnit: 'SQ_FT',
          address: '18 Orchard Crest Way',
          city: 'Austin',
          status: 'AVAILABLE',
        },
        {
          id: '33333333-0003-4000-8000-000000000003',
          code: 'PROP-103',
          name: 'Grand Horizon Residences Apt 1204',
          propertyType: 'APARTMENT',
          listingType: 'RENT',
          priceMicros: 4800000000,
          bedrooms: 2,
          bathrooms: 2,
          builtUpArea: 1350,
          areaUnit: 'SQ_FT',
          address: '88 Ocean Avenue, Suite 1204',
          city: 'Miami',
          status: 'RESERVED',
        },
        {
          id: '33333333-0004-4000-8000-000000000004',
          code: 'PROP-104',
          name: 'Oasis Commercial Plaza Suite 300',
          propertyType: 'COMMERCIAL',
          listingType: 'RENT',
          priceMicros: 9200000000,
          bedrooms: 0,
          bathrooms: 4,
          builtUpArea: 3200,
          areaUnit: 'SQ_FT',
          address: '400 Financial District Blvd, Suite 300',
          city: 'New York',
          status: 'AVAILABLE',
        },
        {
          id: '33333333-0005-4000-8000-000000000005',
          code: 'PROP-105',
          name: 'Sunset Bay Waterfront Villa',
          propertyType: 'VILLA',
          listingType: 'SALE',
          priceMicros: 3200000000000,
          bedrooms: 6,
          bathrooms: 6,
          builtUpArea: 5600,
          areaUnit: 'SQ_FT',
          address: '12 Marina Boulevard',
          city: 'San Diego',
          status: 'SOLD',
        },
        {
          id: '33333333-0006-4000-8000-000000000006',
          code: 'PROP-106',
          name: 'Harmony Heights 3BHK Residence',
          propertyType: 'APARTMENT',
          listingType: 'SALE',
          priceMicros: 780000000000,
          bedrooms: 3,
          bathrooms: 3,
          builtUpArea: 1850,
          areaUnit: 'SQ_FT',
          address: '55 Pinecrest Lane, Apt 8B',
          city: 'Seattle',
          status: 'AVAILABLE',
        },
        {
          id: '33333333-0007-4000-8000-000000000007',
          code: 'PROP-107',
          name: 'Silicon Square Tech Hub Unit 10',
          propertyType: 'COMMERCIAL',
          listingType: 'SALE',
          priceMicros: 1850000000000,
          bedrooms: 0,
          bathrooms: 3,
          builtUpArea: 4100,
          areaUnit: 'SQ_FT',
          address: '1020 Innovation Drive, Unit 10',
          city: 'San Jose',
          status: 'RESERVED',
        },
        {
          id: '33333333-0008-4000-8000-000000000008',
          code: 'PROP-108',
          name: 'Greenfield Premium Villa Plot 18',
          propertyType: 'PLOT',
          listingType: 'SALE',
          priceMicros: 450000000000,
          bedrooms: 0,
          bathrooms: 0,
          builtUpArea: 10000,
          areaUnit: 'SQ_FT',
          address: 'Sector 8 Eco Valley, Plot 18',
          city: 'Denver',
          status: 'AVAILABLE',
        },
      ];

      for (const p of propertyData) {
        await c.query(`
          UPDATE ${dbSchema}.company
          SET
            "propertyId" = $1,
            name = $2,
            "propertyType" = $3,
            "listingType" = $4,
            "priceAmountMicros" = $5,
            "priceCurrencyCode" = 'USD',
            "annualRevenueAmountMicros" = $5,
            "annualRevenueCurrencyCode" = 'USD',
            bedrooms = $6,
            bathrooms = $7,
            "builtUpArea" = $8,
            "areaUnit" = $9,
            "propertyAddress" = $10,
            "addressAddressStreet1" = $10,
            city = $11,
            "addressAddressCity" = $11,
            "propertyStatus" = $12,
            "accountOwnerId" = $13
          WHERE id = $14
        `, [
          p.code, p.name, p.propertyType, p.listingType,
          p.priceMicros, p.bedrooms, p.bathrooms,
          p.builtUpArea, p.areaUnit, p.address,
          p.city, p.status, defaultMemberId, p.id
        ]);
      }

      // Cleanup any dummy / null records if any
      await c.query(`DELETE FROM ${dbSchema}.company WHERE name IS NULL OR name = 'ilakkiya'`);
    }

    // 5. Configure Table Views & Record Details ViewFields
    console.log('👀 Configuring Table View and Record Page Field Columns...');
    const allCompFields = await c.query(`
      SELECT id, name FROM core."fieldMetadata" 
      WHERE "objectMetadataId" = $1
    `, [compObjId]);

    const fieldIdByName = {};
    allCompFields.rows.forEach(r => { fieldIdByName[r.name] = r.id; });

    // Views for company
    const views = await c.query(`
      SELECT id, name, type, key FROM core."view" 
      WHERE "objectMetadataId" = $1
    `, [compObjId]);

    // Order of columns for Property Listings Table View
    const targetTableColumns = [
      { name: 'propertyId', size: 120 },
      { name: 'name', size: 240 },
      { name: 'propertyType', size: 140 },
      { name: 'listingType', size: 120 },
      { name: 'price', size: 140 },
      { name: 'bedrooms', size: 110 },
      { name: 'bathrooms', size: 110 },
      { name: 'builtUpArea', size: 130 },
      { name: 'areaUnit', size: 110 },
      { name: 'propertyAddress', size: 200 },
      { name: 'city', size: 130 },
      { name: 'propertyStatus', size: 140 },
      { name: 'accountOwner', size: 160 },
    ];

    for (const v of views.rows) {
      if (v.type === 'TABLE') {
        // Set existing viewFields to invisible first
        await c.query(`UPDATE core."viewField" SET "isVisible" = false WHERE "viewId" = $1`, [v.id]);

        let pos = 0;
        for (const col of targetTableColumns) {
          const fId = fieldIdByName[col.name];
          if (!fId) continue;

          const existingVF = await c.query(`
            SELECT id FROM core."viewField" 
            WHERE "viewId" = $1 AND "fieldMetadataId" = $2
          `, [v.id, fId]);

          if (existingVF.rows.length > 0) {
            await c.query(`
              UPDATE core."viewField"
              SET "isVisible" = true, position = $1, size = $2
              WHERE id = $3
            `, [pos, col.size, existingVF.rows[0].id]);
          } else {
            await c.query(`
              INSERT INTO core."viewField" (
                id, "universalIdentifier", "fieldMetadataId", "viewId", "workspaceId", "applicationId",
                "isVisible", position, size, "isActive", "isSystemSideEffect", "createdAt", "updatedAt"
              ) VALUES (
                gen_random_uuid(), gen_random_uuid(), $1, $2, $3, $4,
                true, $5, $6, true, false, NOW(), NOW()
              )
            `, [fId, v.id, wsId, appId, pos, col.size]);
          }
          pos++;
        }
      } else if (v.type === 'FIELDS_WIDGET') {
        // Record details page
        let pos = 0;
        for (const col of targetTableColumns) {
          const fId = fieldIdByName[col.name];
          if (!fId) continue;

          const existingVF = await c.query(`
            SELECT id FROM core."viewField" 
            WHERE "viewId" = $1 AND "fieldMetadataId" = $2
          `, [v.id, fId]);

          if (existingVF.rows.length > 0) {
            await c.query(`
              UPDATE core."viewField"
              SET "isVisible" = true, position = $1
              WHERE id = $2
            `, [pos, existingVF.rows[0].id]);
          } else {
            await c.query(`
              INSERT INTO core."viewField" (
                id, "universalIdentifier", "fieldMetadataId", "viewId", "workspaceId", "applicationId",
                "isVisible", position, size, "isActive", "isSystemSideEffect", "createdAt", "updatedAt"
              ) VALUES (
                gen_random_uuid(), gen_random_uuid(), $1, $2, $3, $4,
                true, $5, 200, true, false, NOW(), NOW()
              )
            `, [fId, v.id, wsId, appId, pos]);
          }
          pos++;
        }
      }
    }

    // 6. Invalidate Metadata Version
    await c.query(`UPDATE core.workspace SET "metadataVersion" = "metadataVersion" + 1 WHERE id = $1`, [wsId]);
    console.log('🔄 Incremented metadataVersion for workspace: ' + wsId);
  }

  // Flush Redis Cache
  try {
    execSync('redis-cli flushall', { stdio: 'ignore' });
    console.log('⚡ Redis cache flushed successfully.');
  } catch (e) {
    // ignore
  }

  await c.end();
  console.log('\n✅ All Real Estate Property Listings fields successfully provisioned and ready!');
}

provisionPropertyListingsFields().catch((err) => {
  console.error('❌ Error provisioning fields:', err);
  process.exit(1);
});
