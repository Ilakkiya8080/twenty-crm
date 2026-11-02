/**
 * Real Estate CRM - Modules Field Definitions & Provisioner
 * 
 * Module 1: Property Listings (company)
 * Fields:
 * 1.  Property ID     - Auto-generated / unique identifier (Text / Code)
 * 2.  Property Name   - Text
 * 3.  Property Type   - Select: Apartment, House, Villa, Plot, Commercial
 * 4.  Listing Type    - Select: Sale / Rent
 * 5.  Price           - Currency (amountMicros + currencyCode)
 * 6.  Bedrooms        - Number
 * 7.  Bathrooms       - Number
 * 8.  Built-up Area   - Number
 * 9.  Area Unit       - Select: Sq.ft / Sq.m
 * 10. Address         - Text (Street Address)
 * 11. City            - Text
 * 12. Property Status - Select: Available / Reserved / Sold / Rented / Inactive
 * 13. Assigned Agent  - Relation -> Agents / Users (workspaceMember)
 * 
 * Module 2: Buyers & Leads (person)
 * Fields:
 * 1.  Lead ID                 - Auto-generated / unique (Text)
 * 2.  Full Name               - Text (FULL_NAME)
 * 3.  Phone                   - Phone (PHONES)
 * 4.  Email                   - Email (EMAILS)
 * 5.  Lead Source             - Select: Website, Referral, Ads, Walk-in, Other
 * 6.  Requirement             - Select: Buy / Rent
 * 7.  Preferred Property Type - Select: Apartment, House, Villa, Plot, Commercial
 * 8.  Budget Min              - Currency
 * 9.  Budget Max              - Currency
 * 10. Preferred Location      - Text
 * 11. Assigned Agent          - Relation -> Agents / Users (workspaceMember)
 * 12. Lead Stage              - Select / Pipeline (New, Contacted, Qualified, Negotiation, Closed Won, Closed Lost)
 */

import { FieldMetadataType } from 'twenty-shared/types';

export interface FieldSelectOption {
  id: string;
  label: string;
  value: string;
  position: number;
  color: string;
}

export interface RealEstateFieldDefinition {
  name: string;
  label: string;
  type: FieldMetadataType;
  icon: string;
  description: string;
  isCustom?: boolean;
  options?: FieldSelectOption[];
  defaultValue?: any;
  columnType?: string;
  isUnique?: boolean;
  relationTargetObject?: string;
}

/**
 * 1. Property Listings Field Definitions (company)
 */
export const REAL_ESTATE_PROPERTY_LISTING_FIELDS: RealEstateFieldDefinition[] = [
  {
    name: 'propertyId',
    label: 'Property ID',
    type: FieldMetadataType.TEXT,
    icon: 'IconHash',
    description: 'Auto-generated unique property listing code (e.g., PROP-101)',
    isUnique: true,
  },
  {
    name: 'name',
    label: 'Property Name',
    type: FieldMetadataType.TEXT,
    icon: 'IconBuilding',
    description: 'Headline and property title for marketing and listings',
  },
  {
    name: 'propertyType',
    label: 'Property Type',
    type: FieldMetadataType.SELECT,
    icon: 'IconHome',
    description: 'Category and architectural type of the real estate asset',
    options: [
      { id: '70707070-0001-4000-8000-000000000001', label: 'Apartment', value: 'APARTMENT', position: 0, color: 'blue' },
      { id: '70707070-0002-4000-8000-000000000002', label: 'House', value: 'HOUSE', position: 1, color: 'yellow' },
      { id: '70707070-0003-4000-8000-000000000003', label: 'Villa', value: 'VILLA', position: 2, color: 'green' },
      { id: '70707070-0004-4000-8000-000000000004', label: 'Plot', value: 'PLOT', position: 3, color: 'orange' },
      { id: '70707070-0005-4000-8000-000000000005', label: 'Commercial', value: 'COMMERCIAL', position: 4, color: 'purple' },
    ],
  },
  {
    name: 'listingType',
    label: 'Listing Type',
    type: FieldMetadataType.SELECT,
    icon: 'IconTag',
    description: 'Transaction contract type: Sale or Rent',
    options: [
      { id: '70707070-0011-4000-8000-000000000001', label: 'Sale', value: 'SALE', position: 0, color: 'teal' },
      { id: '70707070-0012-4000-8000-000000000002', label: 'Rent', value: 'RENT', position: 1, color: 'blue' },
    ],
  },
  {
    name: 'price',
    label: 'Price',
    type: FieldMetadataType.CURRENCY,
    icon: 'IconCurrencyDollar',
    description: 'Listing price or monthly rental rate',
  },
  {
    name: 'bedrooms',
    label: 'Bedrooms',
    type: FieldMetadataType.NUMBER,
    icon: 'IconBed',
    description: 'Total number of bedrooms in the property',
  },
  {
    name: 'bathrooms',
    label: 'Bathrooms',
    type: FieldMetadataType.NUMBER,
    icon: 'IconBath',
    description: 'Total number of bathrooms in the property',
  },
  {
    name: 'builtUpArea',
    label: 'Built-up Area',
    type: FieldMetadataType.NUMBER,
    icon: 'IconRulerMeasure',
    description: 'Total built-up or carpet area measurement',
  },
  {
    name: 'areaUnit',
    label: 'Area Unit',
    type: FieldMetadataType.SELECT,
    icon: 'IconRuler2',
    description: 'Measurement unit for the area (Sq.ft or Sq.m)',
    options: [
      { id: '70707070-0021-4000-8000-000000000001', label: 'Sq.ft', value: 'SQ_FT', position: 0, color: 'sky' },
      { id: '70707070-0022-4000-8000-000000000002', label: 'Sq.m', value: 'SQ_M', position: 1, color: 'teal' },
    ],
  },
  {
    name: 'propertyAddress',
    label: 'Address',
    type: FieldMetadataType.TEXT,
    icon: 'IconMapPin',
    description: 'Street address of the property listing',
  },
  {
    name: 'city',
    label: 'City',
    type: FieldMetadataType.TEXT,
    icon: 'IconBuildingCommunity',
    description: 'City or municipality location',
  },
  {
    name: 'propertyStatus',
    label: 'Property Status',
    type: FieldMetadataType.SELECT,
    icon: 'IconProgressCheck',
    description: 'Current real estate listing lifecycle status',
    options: [
      { id: '70707070-0031-4000-8000-000000000001', label: 'Available', value: 'AVAILABLE', position: 0, color: 'green' },
      { id: '70707070-0032-4000-8000-000000000002', label: 'Reserved', value: 'RESERVED', position: 1, color: 'yellow' },
      { id: '70707070-0033-4000-8000-000000000003', label: 'Sold', value: 'SOLD', position: 2, color: 'red' },
      { id: '70707070-0034-4000-8000-000000000004', label: 'Rented', value: 'RENTED', position: 3, color: 'blue' },
      { id: '70707070-0035-4000-8000-000000000005', label: 'Inactive', value: 'INACTIVE', position: 4, color: 'gray' },
    ],
  },
  {
    name: 'accountOwner',
    label: 'Assigned Agent',
    type: FieldMetadataType.RELATION,
    icon: 'IconUserCheck',
    description: 'The real estate agent or broker assigned to this listing',
  },
];

/**
 * 2. Buyers & Leads Field Definitions (person)
 */
export const REAL_ESTATE_BUYER_LEAD_FIELDS: RealEstateFieldDefinition[] = [
  {
    name: 'leadId',
    label: 'Lead ID',
    type: FieldMetadataType.TEXT,
    icon: 'IconHash',
    description: 'Auto-generated unique buyer or lead identification code (e.g., LEAD-101)',
    isUnique: true,
  },
  {
    name: 'name',
    label: 'Full Name',
    type: FieldMetadataType.FULL_NAME,
    icon: 'IconUser',
    description: 'Full name of the prospective buyer or lead',
  },
  {
    name: 'phones',
    label: 'Phone',
    type: FieldMetadataType.PHONES,
    icon: 'IconPhone',
    description: 'Primary contact phone number of the buyer',
  },
  {
    name: 'emails',
    label: 'Email',
    type: FieldMetadataType.EMAILS,
    icon: 'IconMail',
    description: 'Primary contact email address of the buyer',
  },
  {
    name: 'leadSource',
    label: 'Lead Source',
    type: FieldMetadataType.SELECT,
    icon: 'IconTarget',
    description: 'Select: Website, Referral, Ads, Walk-in, Other',
    options: [
      { id: '80808080-0001-4000-8000-000000000001', label: 'Website', value: 'WEBSITE', position: 0, color: 'blue' },
      { id: '80808080-0002-4000-8000-000000000002', label: 'Referral', value: 'REFERRAL', position: 1, color: 'green' },
      { id: '80808080-0003-4000-8000-000000000003', label: 'Ads', value: 'ADS', position: 2, color: 'purple' },
      { id: '80808080-0004-4000-8000-000000000004', label: 'Walk-in', value: 'WALK_IN', position: 3, color: 'orange' },
      { id: '80808080-0005-4000-8000-000000000005', label: 'Other', value: 'OTHER', position: 4, color: 'gray' },
    ],
  },
  {
    name: 'requirement',
    label: 'Requirement',
    type: FieldMetadataType.SELECT,
    icon: 'IconBuildingSkyscraper',
    description: 'Select: Buy / Rent',
    options: [
      { id: '80808080-0011-4000-8000-000000000001', label: 'Buy', value: 'BUY', position: 0, color: 'teal' },
      { id: '80808080-0012-4000-8000-000000000002', label: 'Rent', value: 'RENT', position: 1, color: 'blue' },
    ],
  },
  {
    name: 'preferredPropertyType',
    label: 'Preferred Property Type',
    type: FieldMetadataType.SELECT,
    icon: 'IconHome',
    description: 'Desired property type: Apartment, House, Villa, Plot, Commercial',
    options: [
      { id: '80808080-0021-4000-8000-000000000001', label: 'Apartment', value: 'APARTMENT', position: 0, color: 'blue' },
      { id: '80808080-0022-4000-8000-000000000002', label: 'House', value: 'HOUSE', position: 1, color: 'yellow' },
      { id: '80808080-0023-4000-8000-000000000003', label: 'Villa', value: 'VILLA', position: 2, color: 'green' },
      { id: '80808080-0024-4000-8000-000000000004', label: 'Plot', value: 'PLOT', position: 3, color: 'orange' },
      { id: '80808080-0025-4000-8000-000000000005', label: 'Commercial', value: 'COMMERCIAL', position: 4, color: 'purple' },
    ],
  },
  {
    name: 'budgetMin',
    label: 'Budget Min',
    type: FieldMetadataType.CURRENCY,
    icon: 'IconCurrencyDollar',
    description: 'Minimum acquisition or rental budget',
  },
  {
    name: 'budgetMax',
    label: 'Budget Max',
    type: FieldMetadataType.CURRENCY,
    icon: 'IconCurrencyDollar',
    description: 'Maximum acquisition or rental budget ceiling',
  },
  {
    name: 'preferredLocation',
    label: 'Preferred Location',
    type: FieldMetadataType.TEXT,
    icon: 'IconMapPin',
    description: 'Preferred neighborhood, area, or city location',
  },
  {
    name: 'assignedAgent',
    label: 'Assigned Agent',
    type: FieldMetadataType.RELATION,
    icon: 'IconUserCheck',
    description: 'The real estate agent or broker handling this buyer / lead',
    relationTargetObject: 'workspaceMember',
  },
  {
    name: 'leadStage',
    label: 'Lead Stage',
    type: FieldMetadataType.SELECT,
    icon: 'IconProgressCheck',
    description: 'Select / Pipeline: New, Contacted, Qualified, Negotiation, Closed Won, Closed Lost',
    options: [
      { id: '80808080-0031-4000-8000-000000000001', label: 'New', value: 'NEW', position: 0, color: 'sky' },
      { id: '80808080-0032-4000-8000-000000000002', label: 'Contacted', value: 'CONTACTED', position: 1, color: 'blue' },
      { id: '80808080-0033-4000-8000-000000000003', label: 'Qualified', value: 'QUALIFIED', position: 2, color: 'yellow' },
      { id: '80808080-0034-4000-8000-000000000004', label: 'Negotiation', value: 'NEGOTIATION', position: 3, color: 'orange' },
      { id: '80808080-0035-4000-8000-000000000005', label: 'Closed Won', value: 'CLOSED_WON', position: 4, color: 'green' },
      { id: '80808080-0036-4000-8000-000000000006', label: 'Closed Lost', value: 'CLOSED_LOST', position: 5, color: 'red' },
    ],
  },
];

export interface ProvisionResult {
  workspaceId: string;
  fieldsProvisioned: number;
  status: 'SUCCESS' | 'ERROR';
  message?: string;
}

/**
 * Provision Property Listings fields (company)
 */
export async function provisionRealEstateFields(
  client: any,
  workspaceId: string,
): Promise<ProvisionResult> {
  try {
    const wsRes = await client.query(
      `SELECT id, "displayName", "databaseSchema" FROM core.workspace WHERE id = $1`,
      [workspaceId],
    );

    if (wsRes.rows.length === 0) {
      return { workspaceId, fieldsProvisioned: 0, status: 'ERROR', message: 'Workspace not found' };
    }

    const { databaseSchema: dbSchema } = wsRes.rows[0];

    const appRes = await client.query(
      `SELECT id FROM core.application WHERE "workspaceId" = $1 ORDER BY "createdAt" ASC LIMIT 1`,
      [workspaceId],
    );
    const appId = appRes.rows[0]?.id;

    const objRes = await client.query(
      `SELECT id FROM core."objectMetadata" WHERE "workspaceId" = $1 AND "nameSingular" = 'company'`,
      [workspaceId],
    );
    if (objRes.rows.length === 0) {
      return { workspaceId, fieldsProvisioned: 0, status: 'ERROR', message: 'Company object not found' };
    }
    const compObjId = objRes.rows[0].id;

    // 1. Update Existing Standard Fields
    await client.query(`UPDATE core."fieldMetadata" SET label = 'Property ID', icon = 'IconId', description = 'System unique property ID' WHERE "objectMetadataId" = $1 AND name = 'id'`, [compObjId]);
    await client.query(`UPDATE core."fieldMetadata" SET label = 'Property Name', icon = 'IconBuilding', description = 'Headline and property title for marketing and listings' WHERE "objectMetadataId" = $1 AND name = 'name'`, [compObjId]);
    await client.query(`UPDATE core."fieldMetadata" SET label = 'Price', icon = 'IconCurrencyDollar', description = 'Listing price or monthly rental rate' WHERE "objectMetadataId" = $1 AND name = 'annualRevenue'`, [compObjId]);
    await client.query(`UPDATE core."fieldMetadata" SET label = 'Address', icon = 'IconMapPin', description = 'Street address of the property listing' WHERE "objectMetadataId" = $1 AND name = 'address'`, [compObjId]);
    await client.query(`UPDATE core."fieldMetadata" SET label = 'Assigned Agent', icon = 'IconUserCheck', description = 'The real estate agent or broker assigned to this listing' WHERE "objectMetadataId" = $1 AND name = 'accountOwner'`, [compObjId]);

    // 2. Insert Custom Fields
    const customFields = REAL_ESTATE_PROPERTY_LISTING_FIELDS.filter(f => !['name', 'accountOwner'].includes(f.name));
    for (const f of customFields) {
      const existing = await client.query(
        `SELECT id FROM core."fieldMetadata" WHERE "objectMetadataId" = $1 AND name = $2`,
        [compObjId, f.name],
      );

      if (existing.rows.length === 0) {
        await client.query(`
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
          compObjId, workspaceId, appId,
          f.name, f.label, f.type, f.icon, f.description,
          f.options ? JSON.stringify(f.options) : null,
        ]);
      } else {
        await client.query(`
          UPDATE core."fieldMetadata"
          SET label = $1, icon = $2, description = $3, options = $4, "isActive" = true, "isUIEditable" = true
          WHERE id = $5
        `, [
          f.label, f.icon, f.description,
          f.options ? JSON.stringify(f.options) : null,
          existing.rows[0].id,
        ]);
      }
    }

    // 3. PostgreSQL Enums and Physical Columns
    if (dbSchema) {
      await client.query(`
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
    }

    // 4. Invalidate Metadata
    await client.query(`UPDATE core.workspace SET "metadataVersion" = "metadataVersion" + 1 WHERE id = $1`, [workspaceId]);

    return {
      workspaceId,
      fieldsProvisioned: REAL_ESTATE_PROPERTY_LISTING_FIELDS.length,
      status: 'SUCCESS',
    };
  } catch (err: any) {
    return {
      workspaceId,
      fieldsProvisioned: 0,
      status: 'ERROR',
      message: err.message,
    };
  }
}

/**
 * Provision Buyers & Leads fields (person)
 */
export async function provisionRealEstateBuyerLeadFields(
  client: any,
  workspaceId: string,
): Promise<ProvisionResult> {
  try {
    const wsRes = await client.query(
      `SELECT id, "displayName", "databaseSchema" FROM core.workspace WHERE id = $1`,
      [workspaceId],
    );

    if (wsRes.rows.length === 0) {
      return { workspaceId, fieldsProvisioned: 0, status: 'ERROR', message: 'Workspace not found' };
    }

    const { databaseSchema: dbSchema } = wsRes.rows[0];

    const appRes = await client.query(
      `SELECT id FROM core.application WHERE "workspaceId" = $1 ORDER BY "createdAt" ASC LIMIT 1`,
      [workspaceId],
    );
    const appId = appRes.rows[0]?.id;

    const objRes = await client.query(
      `SELECT id FROM core."objectMetadata" WHERE "workspaceId" = $1 AND "nameSingular" = 'person'`,
      [workspaceId],
    );
    if (objRes.rows.length === 0) {
      return { workspaceId, fieldsProvisioned: 0, status: 'ERROR', message: 'Person object not found' };
    }
    const personObjId = objRes.rows[0].id;

    const memberObjRes = await client.query(
      `SELECT id FROM core."objectMetadata" WHERE "workspaceId" = $1 AND "nameSingular" = 'workspaceMember'`,
      [workspaceId],
    );
    const memberObjId = memberObjRes.rows.length > 0 ? memberObjRes.rows[0].id : null;

    // 1. Update Existing Standard Fields
    await client.query(`UPDATE core."fieldMetadata" SET label = 'Full Name', icon = 'IconUser', description = 'Full name of the prospective buyer or lead' WHERE "objectMetadataId" = $1 AND name = 'name'`, [personObjId]);
    await client.query(`UPDATE core."fieldMetadata" SET label = 'Phone', icon = 'IconPhone', description = 'Primary contact phone number of the buyer' WHERE "objectMetadataId" = $1 AND name = 'phones'`, [personObjId]);
    await client.query(`UPDATE core."fieldMetadata" SET label = 'Email', icon = 'IconMail', description = 'Primary contact email address of the buyer' WHERE "objectMetadataId" = $1 AND name = 'emails'`, [personObjId]);

    // 2. Insert or update custom fields
    const customFields = REAL_ESTATE_BUYER_LEAD_FIELDS.filter(f => !['name', 'phones', 'emails'].includes(f.name));
    for (const f of customFields) {
      const existing = await client.query(
        `SELECT id FROM core."fieldMetadata" WHERE "objectMetadataId" = $1 AND name = $2`,
        [personObjId, f.name],
      );

      const relationTargetObjId = f.name === 'assignedAgent' ? memberObjId : null;
      const relationSettings = f.name === 'assignedAgent'
        ? JSON.stringify({ onDelete: 'SET_NULL', relationType: 'MANY_TO_ONE', joinColumnName: 'assignedAgentId' })
        : null;

      if (existing.rows.length === 0) {
        await client.query(`
          INSERT INTO core."fieldMetadata" (
            id, "universalIdentifier", "objectMetadataId", "workspaceId", "applicationId",
            name, label, type, icon, description, options, "isActive", "isSystem",
            "isUIEditable", "isUIReadOnly", "isNullable", "isLabelSyncedWithName",
            "relationTargetObjectMetadataId", settings, "createdAt", "updatedAt"
          ) VALUES (
            gen_random_uuid(), gen_random_uuid(), $1, $2, $3,
            $4, $5, $6, $7, $8, $9, true, false,
            true, false, true, false,
            $10, $11, NOW(), NOW()
          )
        `, [
          personObjId, workspaceId, appId,
          f.name, f.label, f.type, f.icon, f.description,
          f.options ? JSON.stringify(f.options) : null,
          relationTargetObjId, relationSettings,
        ]);
      } else {
        await client.query(`
          UPDATE core."fieldMetadata"
          SET label = $1, icon = $2, description = $3, options = $4,
              "relationTargetObjectMetadataId" = $5, settings = $6, "updatedAt" = NOW()
          WHERE id = $7
        `, [
          f.label, f.icon, f.description,
          f.options ? JSON.stringify(f.options) : null,
          relationTargetObjId, relationSettings,
          existing.rows[0].id,
        ]);
      }
    }

    // 3. PostgreSQL Enums and Columns
    if (dbSchema) {
      await client.query(`
        DO $$
        BEGIN
          IF NOT EXISTS (SELECT 1 FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace WHERE t.typname = 'person_leadSource_enum' AND n.nspname = '${dbSchema}') THEN
            CREATE TYPE ${dbSchema}."person_leadSource_enum" AS ENUM ('WEBSITE', 'REFERRAL', 'ADS', 'WALK_IN', 'OTHER');
          END IF;
          IF NOT EXISTS (SELECT 1 FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace WHERE t.typname = 'person_requirement_enum' AND n.nspname = '${dbSchema}') THEN
            CREATE TYPE ${dbSchema}."person_requirement_enum" AS ENUM ('BUY', 'RENT');
          END IF;
          IF NOT EXISTS (SELECT 1 FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace WHERE t.typname = 'person_preferredPropertyType_enum' AND n.nspname = '${dbSchema}') THEN
            CREATE TYPE ${dbSchema}."person_preferredPropertyType_enum" AS ENUM ('APARTMENT', 'HOUSE', 'VILLA', 'PLOT', 'COMMERCIAL');
          END IF;
          IF NOT EXISTS (SELECT 1 FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace WHERE t.typname = 'person_leadStage_enum' AND n.nspname = '${dbSchema}') THEN
            CREATE TYPE ${dbSchema}."person_leadStage_enum" AS ENUM ('NEW', 'CONTACTED', 'QUALIFIED', 'NEGOTIATION', 'CLOSED_WON', 'CLOSED_LOST');
          END IF;
        END $$;

        CREATE SEQUENCE IF NOT EXISTS ${dbSchema}.person_lead_id_seq START WITH 109;

        ALTER TABLE ${dbSchema}.person ADD COLUMN IF NOT EXISTS "leadId" text;
        ALTER TABLE ${dbSchema}.person ADD COLUMN IF NOT EXISTS "leadSource" ${dbSchema}."person_leadSource_enum";
        ALTER TABLE ${dbSchema}.person ADD COLUMN IF NOT EXISTS "requirement" ${dbSchema}."person_requirement_enum";
        ALTER TABLE ${dbSchema}.person ADD COLUMN IF NOT EXISTS "preferredPropertyType" ${dbSchema}."person_preferredPropertyType_enum";
        ALTER TABLE ${dbSchema}.person ADD COLUMN IF NOT EXISTS "budgetMinAmountMicros" numeric;
        ALTER TABLE ${dbSchema}.person ADD COLUMN IF NOT EXISTS "budgetMinCurrencyCode" text DEFAULT 'USD';
        ALTER TABLE ${dbSchema}.person ADD COLUMN IF NOT EXISTS "budgetMaxAmountMicros" numeric;
        ALTER TABLE ${dbSchema}.person ADD COLUMN IF NOT EXISTS "budgetMaxCurrencyCode" text DEFAULT 'USD';
        ALTER TABLE ${dbSchema}.person ADD COLUMN IF NOT EXISTS "preferredLocation" text;
        ALTER TABLE ${dbSchema}.person ADD COLUMN IF NOT EXISTS "assignedAgentId" uuid;
        ALTER TABLE ${dbSchema}.person ADD COLUMN IF NOT EXISTS "leadStage" ${dbSchema}."person_leadStage_enum";
      `);
    }

    // 4. Invalidate Metadata
    await client.query(`UPDATE core.workspace SET "metadataVersion" = "metadataVersion" + 1 WHERE id = $1`, [workspaceId]);

    return {
      workspaceId,
      fieldsProvisioned: REAL_ESTATE_BUYER_LEAD_FIELDS.length,
      status: 'SUCCESS',
    };
  } catch (err: any) {
    return {
      workspaceId,
      fieldsProvisioned: 0,
      status: 'ERROR',
      message: err.message,
    };
  }
}
