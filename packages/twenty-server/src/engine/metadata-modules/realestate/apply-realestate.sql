-- ============================================================================
-- REAL ESTATE CRM COMPLETE WORKSPACE PROVISIONING & SEED SCRIPT
-- ============================================================================

-- Step 1: Add and commit new Enum Values in a separate transaction block
DO $$
DECLARE
    ws_rec RECORD;
BEGIN
    FOR ws_rec IN SELECT "databaseSchema" FROM core.workspace WHERE "deletedAt" IS NULL LOOP
        IF ws_rec."databaseSchema" IS NOT NULL THEN
            BEGIN
                EXECUTE format('ALTER TYPE %I.opportunity_stage_enum ADD VALUE IF NOT EXISTS ''NEW_DEAL''', ws_rec."databaseSchema");
                EXECUTE format('ALTER TYPE %I.opportunity_stage_enum ADD VALUE IF NOT EXISTS ''NEGOTIATION''', ws_rec."databaseSchema");
                EXECUTE format('ALTER TYPE %I.opportunity_stage_enum ADD VALUE IF NOT EXISTS ''DOCUMENTATION''', ws_rec."databaseSchema");
                EXECUTE format('ALTER TYPE %I.opportunity_stage_enum ADD VALUE IF NOT EXISTS ''CLOSED_WON''', ws_rec."databaseSchema");
                EXECUTE format('ALTER TYPE %I.opportunity_stage_enum ADD VALUE IF NOT EXISTS ''CLOSED_LOST''', ws_rec."databaseSchema");
                EXECUTE format('ALTER TYPE %I.opportunity_stage_enum ADD VALUE IF NOT EXISTS ''NEW_LEAD''', ws_rec."databaseSchema");
                EXECUTE format('ALTER TYPE %I.opportunity_stage_enum ADD VALUE IF NOT EXISTS ''QUALIFIED''', ws_rec."databaseSchema");
                EXECUTE format('ALTER TYPE %I.opportunity_stage_enum ADD VALUE IF NOT EXISTS ''SITE_VISIT''', ws_rec."databaseSchema");
                EXECUTE format('ALTER TYPE %I.opportunity_stage_enum ADD VALUE IF NOT EXISTS ''CONVERTED''', ws_rec."databaseSchema");
                EXECUTE format('ALTER TYPE %I.opportunity_stage_enum ADD VALUE IF NOT EXISTS ''LOST''', ws_rec."databaseSchema");
            EXCEPTION WHEN OTHERS THEN
                NULL;
            END;
        END IF;
    END LOOP;
END $$;

-- Step 2: Metadata Provisioning, View Configuration, Sidebar Navigation, and Record Seeding
DO $$
DECLARE
    ws_rec RECORD;
    ws_id UUID;
    db_schema TEXT;
    app_id UUID;
    comp_obj_id UUID;
    person_obj_id UUID;
    note_obj_id UUID;
    opp_obj_id UUID;
    task_obj_id UUID;
    dash_obj_id UUID;
    member_obj_id UUID;
    opp_stage_field_id UUID;
    deal_kanban_view_id UUID;
    lead_kanban_view_id UUID;

    -- Property IDs (company)
    prop1 UUID := '33333333-0001-4000-8000-000000000001';
    prop2 UUID := '33333333-0002-4000-8000-000000000002';
    prop3 UUID := '33333333-0003-4000-8000-000000000003';
    prop4 UUID := '33333333-0004-4000-8000-000000000004';
    prop5 UUID := '33333333-0005-4000-8000-000000000005';
    prop6 UUID := '33333333-0006-4000-8000-000000000006';
    prop7 UUID := '33333333-0007-4000-8000-000000000007';
    prop8 UUID := '33333333-0008-4000-8000-000000000008';

    -- Buyers & Leads IDs (person)
    lead1 UUID := '44444444-0001-4000-8000-000000000001';
    lead2 UUID := '44444444-0002-4000-8000-000000000002';
    lead3 UUID := '44444444-0003-4000-8000-000000000003';
    lead4 UUID := '44444444-0004-4000-8000-000000000004';
    lead5 UUID := '44444444-0005-4000-8000-000000000005';
    lead6 UUID := '44444444-0006-4000-8000-000000000006';
    lead7 UUID := '44444444-0007-4000-8000-000000000007';
    lead8 UUID := '44444444-0008-4000-8000-000000000008';

    -- Site Visit IDs (note)
    vis1 UUID := '55555555-0001-4000-8000-000000000001';
    vis2 UUID := '55555555-0002-4000-8000-000000000002';
    vis3 UUID := '55555555-0003-4000-8000-000000000003';
    vis4 UUID := '55555555-0004-4000-8000-000000000004';
    vis5 UUID := '55555555-0005-4000-8000-000000000005';
    vis6 UUID := '55555555-0006-4000-8000-000000000006';
    vis7 UUID := '55555555-0007-4000-8000-000000000007';
    vis8 UUID := '55555555-0008-4000-8000-000000000008';

    -- Deal IDs (opportunity)
    deal1 UUID := '66666666-0001-4000-8000-000000000001';
    deal2 UUID := '66666666-0002-4000-8000-000000000002';
    deal3 UUID := '66666666-0003-4000-8000-000000000003';
    deal4 UUID := '66666666-0004-4000-8000-000000000004';
    deal5 UUID := '66666666-0005-4000-8000-000000000005';
    deal6 UUID := '66666666-0006-4000-8000-000000000006';
    deal7 UUID := '66666666-0007-4000-8000-000000000007';
    deal8 UUID := '66666666-0008-4000-8000-000000000008';

    -- Follow-up IDs (task)
    fu1 UUID := '77777777-0001-4000-8000-000000000001';
    fu2 UUID := '77777777-0002-4000-8000-000000000002';
    fu3 UUID := '77777777-0003-4000-8000-000000000003';
    fu4 UUID := '77777777-0004-4000-8000-000000000004';
    fu5 UUID := '77777777-0005-4000-8000-000000000005';
    fu6 UUID := '77777777-0006-4000-8000-000000000006';
    fu7 UUID := '77777777-0007-4000-8000-000000000007';
    fu8 UUID := '77777777-0008-4000-8000-000000000008';

    -- Report IDs (dashboard)
    rep1 UUID := '88888888-0001-4000-8000-000000000001';
    rep2 UUID := '88888888-0002-4000-8000-000000000002';
    rep3 UUID := '88888888-0003-4000-8000-000000000003';
    rep4 UUID := '88888888-0004-4000-8000-000000000004';
    rep5 UUID := '88888888-0005-4000-8000-000000000005';
    rep6 UUID := '88888888-0006-4000-8000-000000000006';

BEGIN
    FOR ws_rec IN SELECT id, "databaseSchema" FROM core.workspace WHERE "deletedAt" IS NULL LOOP
        ws_id := ws_rec.id;
        db_schema := ws_rec."databaseSchema";

        RAISE NOTICE 'Provisioning Real Estate CRM for Workspace: % (Schema: %)', ws_id, db_schema;

        -- Fetch or Create Application ID
        SELECT id INTO app_id FROM core."application" WHERE "workspaceId" = ws_id LIMIT 1;
        IF app_id IS NULL THEN
            app_id := gen_random_uuid();
            INSERT INTO core."application" (id, "workspaceId", "createdAt", "updatedAt")
            VALUES (app_id, ws_id, NOW(), NOW());
        END IF;

        -- 1. Update Core Object Metadata Labels and Icons to Pure Real Estate
        -- 0. Property Listings (company)
        UPDATE core."objectMetadata"
        SET "labelPlural" = 'Property Listings', "labelSingular" = 'Property Listing', icon = 'IconBuildingSkyscraper', color = 'turquoise', "isActive" = true
        WHERE "workspaceId" = ws_id AND "nameSingular" = 'Property Listings';

        -- 1. Buyers & Leads (person)
        UPDATE core."objectMetadata"
        SET "labelPlural" = 'Buyers & Leads', "labelSingular" = 'Buyer & Lead', icon = 'IconUserCheck', color = 'blue', "isActive" = true
        WHERE "workspaceId" = ws_id AND "nameSingular" = 'Buyers & Leads';

        -- 2. Site Visits (note)
        UPDATE core."objectMetadata"
        SET "labelPlural" = 'Site Visits', "labelSingular" = 'Site Visit', icon = 'IconCalendarEvent', color = 'sky', "isActive" = true
        WHERE "workspaceId" = ws_id AND "nameSingular" = 'Site Visits';

        -- 3. Deals (opportunity)
        UPDATE core."objectMetadata"
        SET "labelPlural" = 'opportunity', "labelSingular" = 'opportunity', icon = 'IconCurrencyDollar', color = 'green', "isActive" = true
        WHERE "workspaceId" = ws_id AND "nameSingular" = 'opportunity';

        -- 4. Follow-ups (task)
        UPDATE core."objectMetadata"
        SET "labelPlural" = 'Follow-ups', "labelSingular" = 'Follow-up', icon = 'IconPhoneCall', color = 'orange', "isActive" = true
        WHERE "workspaceId" = ws_id AND "nameSingular" = 'Follow-ups';

        -- 5. Reports (dashboard)
        UPDATE core."objectMetadata"
        SET "labelPlural" = 'Reports', "labelSingular" = 'Report', icon = 'IconChartPie', color = 'purple', "isActive" = true
        WHERE "workspaceId" = ws_id AND "nameSingular" = 'Reports';

        -- Agents / Team (workspaceMember)
        UPDATE core."objectMetadata"
        SET "labelPlural" = 'Agents & Brokers', "labelSingular" = 'Agent', icon = 'IconUserCheck', color = 'purple', "isActive" = true, "isUICreatable" = true, "isUIEditable" = true, "isUIReadOnly" = false
        WHERE "workspaceId" = ws_id AND "nameSingular" = 'workspaceMember';

        UPDATE core."fieldMetadata"
        SET "isUIEditable" = true
        WHERE "objectMetadataId" = (SELECT id FROM core."objectMetadata" WHERE "workspaceId" = ws_id AND "nameSingular" = 'workspaceMember')
          AND name IN ('name', 'jobTitle', 'userEmail', 'avatarUrl');

        UPDATE core."fieldMetadata"
        SET "isNullable" = true, "defaultValue" = '"uuid"'::jsonb
        WHERE "objectMetadataId" = (SELECT id FROM core."objectMetadata" WHERE "workspaceId" = ws_id AND "nameSingular" = 'workspaceMember')
          AND name = 'userId';

        -- Deactivate clinical/manufacturing objects
        UPDATE core."objectMetadata"
        SET "isActive" = false
        WHERE "workspaceId" = ws_id AND "nameSingular" IN (
            'product', 'productionOrder', 'rawMaterial', 'supplier', 'inventoryItem', 'qualityReport',
            'patient', 'doctor', 'appointment', 'department', 'medicalRecord'
        );

        -- Fetch Object IDs
        SELECT id INTO comp_obj_id FROM core."objectMetadata" WHERE "workspaceId" = ws_id AND "nameSingular" = 'company';
        SELECT id INTO person_obj_id FROM core."objectMetadata" WHERE "workspaceId" = ws_id AND "nameSingular" = 'person';
        SELECT id INTO note_obj_id FROM core."objectMetadata" WHERE "workspaceId" = ws_id AND "nameSingular" = 'note';
        SELECT id INTO opp_obj_id FROM core."objectMetadata" WHERE "workspaceId" = ws_id AND "nameSingular" = 'opportunity';
        SELECT id INTO task_obj_id FROM core."objectMetadata" WHERE "workspaceId" = ws_id AND "nameSingular" = 'task';
        SELECT id INTO dash_obj_id FROM core."objectMetadata" WHERE "workspaceId" = ws_id AND "nameSingular" = 'dashboard';
        SELECT id INTO member_obj_id FROM core."objectMetadata" WHERE "workspaceId" = ws_id AND "nameSingular" = 'workspaceMember';

        -- 2. Update Stage options in fieldMetadata
        SELECT id INTO opp_stage_field_id FROM core."fieldMetadata"
        WHERE "objectMetadataId" = opp_obj_id AND name = 'stage' LIMIT 1;

        IF opp_stage_field_id IS NOT NULL THEN
            UPDATE core."fieldMetadata"
            SET options = '[
                {"id": "30303030-0001-4000-8000-000000000001", "color": "sky", "label": "New Deal", "value": "NEW_DEAL", "position": 0},
                {"id": "30303030-0002-4000-8000-000000000002", "color": "yellow", "label": "Negotiation", "value": "NEGOTIATION", "position": 1},
                {"id": "30303030-0003-4000-8000-000000000003", "color": "purple", "label": "Documentation", "value": "DOCUMENTATION", "position": 2},
                {"id": "30303030-0004-4000-8000-000000000004", "color": "green", "label": "Closed Won", "value": "CLOSED_WON", "position": 3},
                {"id": "30303030-0005-4000-8000-000000000005", "color": "red", "label": "Closed Lost", "value": "CLOSED_LOST", "position": 4}
            ]'::jsonb
            WHERE id = opp_stage_field_id;
        END IF;

        -- 3. Configure Views
        -- Deal Pipeline Kanban View
        SELECT id INTO deal_kanban_view_id FROM core."view"
        WHERE "objectMetadataId" = opp_obj_id AND type = 'KANBAN' LIMIT 1;

        IF deal_kanban_view_id IS NOT NULL THEN
            UPDATE core."view"
            SET name = 'Deal Pipeline',
                "mainGroupByFieldMetadataId" = opp_stage_field_id,
                icon = 'IconCurrencyDollar'
            WHERE id = deal_kanban_view_id;
        ELSE
            deal_kanban_view_id := gen_random_uuid();
            INSERT INTO core."view" (
                id, "universalIdentifier", name, "objectMetadataId", type, icon, position,
                "workspaceId", "applicationId", "mainGroupByFieldMetadataId", "createdAt", "updatedAt"
            ) VALUES (
                deal_kanban_view_id, gen_random_uuid(), 'Deal Pipeline', opp_obj_id, 'KANBAN',
                'IconCurrencyDollar', 1, ws_id, app_id, opp_stage_field_id, NOW(), NOW()
            );
        END IF;

        -- View Groups for Deal Pipeline
        DELETE FROM core."viewGroup" WHERE "viewId" = deal_kanban_view_id;
        INSERT INTO core."viewGroup" (id, "universalIdentifier", "viewId", "fieldValue", "isVisible", position, "workspaceId", "applicationId", "createdAt", "updatedAt")
        VALUES
            (gen_random_uuid(), gen_random_uuid(), deal_kanban_view_id, 'NEW_DEAL', true, 0, ws_id, app_id, NOW(), NOW()),
            (gen_random_uuid(), gen_random_uuid(), deal_kanban_view_id, 'NEGOTIATION', true, 1, ws_id, app_id, NOW(), NOW()),
            (gen_random_uuid(), gen_random_uuid(), deal_kanban_view_id, 'DOCUMENTATION', true, 2, ws_id, app_id, NOW(), NOW()),
            (gen_random_uuid(), gen_random_uuid(), deal_kanban_view_id, 'CLOSED_WON', true, 3, ws_id, app_id, NOW(), NOW()),
            (gen_random_uuid(), gen_random_uuid(), deal_kanban_view_id, 'CLOSED_LOST', true, 4, ws_id, app_id, NOW(), NOW());

        -- Lead Pipeline Kanban View
        SELECT id INTO lead_kanban_view_id FROM core."view"
        WHERE "objectMetadataId" = opp_obj_id AND name = 'Lead Pipeline' LIMIT 1;

        IF lead_kanban_view_id IS NULL THEN
            lead_kanban_view_id := gen_random_uuid();
            INSERT INTO core."view" (
                id, "universalIdentifier", name, "objectMetadataId", type, icon, position,
                "workspaceId", "applicationId", "mainGroupByFieldMetadataId", "createdAt", "updatedAt"
            ) VALUES (
                lead_kanban_view_id, gen_random_uuid(), 'Lead Pipeline', opp_obj_id, 'KANBAN',
                'IconUserCheck', 2, ws_id, app_id, opp_stage_field_id, NOW(), NOW()
            );
        END IF;

        DELETE FROM core."viewGroup" WHERE "viewId" = lead_kanban_view_id;
        INSERT INTO core."viewGroup" (id, "universalIdentifier", "viewId", "fieldValue", "isVisible", position, "workspaceId", "applicationId", "createdAt", "updatedAt")
        VALUES
            (gen_random_uuid(), gen_random_uuid(), lead_kanban_view_id, 'NEW_LEAD', true, 0, ws_id, app_id, NOW(), NOW()),
            (gen_random_uuid(), gen_random_uuid(), lead_kanban_view_id, 'QUALIFIED', true, 1, ws_id, app_id, NOW(), NOW()),
            (gen_random_uuid(), gen_random_uuid(), lead_kanban_view_id, 'SITE_VISIT', true, 2, ws_id, app_id, NOW(), NOW()),
            (gen_random_uuid(), gen_random_uuid(), lead_kanban_view_id, 'NEGOTIATION', true, 3, ws_id, app_id, NOW(), NOW()),
            (gen_random_uuid(), gen_random_uuid(), lead_kanban_view_id, 'CONVERTED', true, 4, ws_id, app_id, NOW(), NOW()),
            (gen_random_uuid(), gen_random_uuid(), lead_kanban_view_id, 'LOST', true, 5, ws_id, app_id, NOW(), NOW());

        -- Update Table Views
        UPDATE core."view" SET name = 'All Property Listings', icon = 'IconBuildingSkyscraper'
        WHERE "objectMetadataId" = comp_obj_id;

        UPDATE core."view" SET name = 'All Buyers & Leads', icon = 'IconUserCheck'
        WHERE "objectMetadataId" = person_obj_id;

        UPDATE core."view" SET name = 'All Site Visits', icon = 'IconCalendarEvent'
        WHERE "objectMetadataId" = note_obj_id;

        UPDATE core."view" SET name = 'All Deals', icon = 'IconCurrencyDollar'
        WHERE "objectMetadataId" = opp_obj_id AND type = 'TABLE';

        UPDATE core."view" SET name = 'All Follow-ups', icon = 'IconPhoneCall'
        WHERE "objectMetadataId" = task_obj_id;

        UPDATE core."view" SET name = 'Real Estate Reports & Analytics', icon = 'IconChartPie'
        WHERE "objectMetadataId" = dash_obj_id;

        UPDATE core."view" SET name = 'All Agents', icon = 'IconUserCheck'
        WHERE "objectMetadataId" = member_obj_id;

        -- 4. Reconfigure Sidebar Navigation Menu (REAL ESTATE MODULES INCLUDING AGENTS MODULE ONLY FOR REAL ESTATE)
        DELETE FROM core."navigationMenuItem" WHERE "workspaceId" = ws_id;

        -- Pos 0: Property Listings (company)
        INSERT INTO core."navigationMenuItem" (id, "universalIdentifier", "workspaceId", "applicationId", "targetObjectMetadataId", position, type, color, icon, name, "createdAt", "updatedAt")
        VALUES (gen_random_uuid(), gen_random_uuid(), ws_id, app_id, comp_obj_id, 0, 'OBJECT', 'turquoise', 'IconBuildingSkyscraper', 'Property Listings', NOW(), NOW());

        -- Pos 1: Buyers & Leads (person)
        INSERT INTO core."navigationMenuItem" (id, "universalIdentifier", "workspaceId", "applicationId", "targetObjectMetadataId", position, type, color, icon, name, "createdAt", "updatedAt")
        VALUES (gen_random_uuid(), gen_random_uuid(), ws_id, app_id, person_obj_id, 1, 'OBJECT', 'blue', 'IconUserCheck', 'Buyers & Leads', NOW(), NOW());

        -- Pos 2: Site Visits (note)
        INSERT INTO core."navigationMenuItem" (id, "universalIdentifier", "workspaceId", "applicationId", "targetObjectMetadataId", position, type, color, icon, name, "createdAt", "updatedAt")
        VALUES (gen_random_uuid(), gen_random_uuid(), ws_id, app_id, note_obj_id, 2, 'OBJECT', 'sky', 'IconCalendarEvent', 'Site Visits', NOW(), NOW());

        -- Pos 3: Deals (opportunity)
        INSERT INTO core."navigationMenuItem" (id, "universalIdentifier", "workspaceId", "applicationId", "targetObjectMetadataId", position, type, color, icon, name, "createdAt", "updatedAt")
        VALUES (gen_random_uuid(), gen_random_uuid(), ws_id, app_id, opp_obj_id, 3, 'OBJECT', 'green', 'IconCurrencyDollar', 'Deals', NOW(), NOW());

        -- Pos 4: Follow-ups (task)
        INSERT INTO core."navigationMenuItem" (id, "universalIdentifier", "workspaceId", "applicationId", "targetObjectMetadataId", position, type, color, icon, name, "createdAt", "updatedAt")
        VALUES (gen_random_uuid(), gen_random_uuid(), ws_id, app_id, task_obj_id, 4, 'OBJECT', 'orange', 'IconPhoneCall', 'Follow-ups', NOW(), NOW());

        -- Pos 5: Reports (dashboard)
        INSERT INTO core."navigationMenuItem" (id, "universalIdentifier", "workspaceId", "applicationId", "targetObjectMetadataId", position, type, color, icon, name, "createdAt", "updatedAt")
        VALUES (gen_random_uuid(), gen_random_uuid(), ws_id, app_id, dash_obj_id, 5, 'OBJECT', 'purple', 'IconChartPie', 'Reports', NOW(), NOW());

        -- Pos 6: Agents (workspaceMember) - Only for Real Estate CRM
        INSERT INTO core."navigationMenuItem" (id, "universalIdentifier", "workspaceId", "applicationId", "targetObjectMetadataId", position, type, color, icon, name, "createdAt", "updatedAt")
        VALUES (gen_random_uuid(), gen_random_uuid(), ws_id, app_id, member_obj_id, 6, 'OBJECT', 'purple', 'IconUserCheck', 'Agents', NOW(), NOW());

        -- 5. Seed Real Real Estate Data into Schema
        IF db_schema IS NOT NULL THEN
            EXECUTE format('DELETE FROM %I."timelineActivity"', db_schema);
            EXECUTE format('DELETE FROM %I."taskTarget"', db_schema);
            EXECUTE format('DELETE FROM %I."noteTarget"', db_schema);
            EXECUTE format('DELETE FROM %I.task', db_schema);
            EXECUTE format('DELETE FROM %I.opportunity', db_schema);
            EXECUTE format('DELETE FROM %I.person', db_schema);
            EXECUTE format('DELETE FROM %I.company', db_schema);
            EXECUTE format('DELETE FROM %I.note', db_schema);
            EXECUTE format('DELETE FROM %I.dashboard', db_schema);

            -- A. Property Listings (company) - 8 Properties
            EXECUTE format('
                INSERT INTO %I.company (
                    id, name, "domainNamePrimaryLinkLabel", "domainNamePrimaryLinkUrl", "linkedinLinkPrimaryLinkLabel", "linkedinLinkPrimaryLinkUrl", "addressAddressStreet1", "addressAddressCity",
                    "annualRevenueAmountMicros", "annualRevenueCurrencyCode",
                    position, "createdByName", "updatedByName", "createdBySource", "updatedBySource", "createdAt", "updatedAt"
                ) VALUES
                    (%L, ''Skyline Grand Penthouse'', ''Villa/Penthouse • For Sale • Available'', ''https://realestate-crm.internal/listings/skyline-penthouse'', ''$2,450,000 • 4 Bed / 5 Bath • 4,800 Sq.ft'', ''https://linkedin.com'', ''742 Evergreen Terrace, Floor 42'', ''San Francisco, CA'', 2450000000000, ''USD'', 0, ''System'', ''System'', ''MANUAL'', ''MANUAL'', NOW(), NOW()),
                    (%L, ''Emerald Valley Luxury Villa 4B'', ''Villa • For Sale • Available'', ''https://realestate-crm.internal/listings/emerald-valley-4b'', ''$1,650,000 • 5 Bed / 4 Bath • 3,950 Sq.ft'', ''https://linkedin.com'', ''18 Orchard Crest Way'', ''Austin, TX'', 1650000000000, ''USD'', 1, ''System'', ''System'', ''MANUAL'', ''MANUAL'', NOW(), NOW()),
                    (%L, ''Grand Horizon Residences Apt 1204'', ''Apartment • For Rent ($4,800/mo) • Reserved'', ''https://realestate-crm.internal/listings/grand-horizon-1204'', ''$4,800 / mo • 2 Bed / 2 Bath • 1,350 Sq.ft'', ''https://linkedin.com'', ''88 Ocean Avenue, Suite 1204'', ''Miami, FL'', 57600000000, ''USD'', 2, ''System'', ''System'', ''MANUAL'', ''MANUAL'', NOW(), NOW()),
                    (%L, ''Oasis Commercial Plaza Suite 300'', ''Commercial • For Rent ($9,200/mo) • Available'', ''https://realestate-crm.internal/listings/oasis-plaza-300'', ''$9,200 / mo • Commercial Lease • 3,200 Sq.ft'', ''https://linkedin.com'', ''400 Financial District Blvd, Suite 300'', ''New York, NY'', 110400000000, ''USD'', 3, ''System'', ''System'', ''MANUAL'', ''MANUAL'', NOW(), NOW()),
                    (%L, ''Sunset Bay Waterfront Villa'', ''Waterfront Villa • For Sale • Sold'', ''https://realestate-crm.internal/listings/sunset-bay-villa'', ''$3,200,000 • 6 Bed / 6 Bath • 5,600 Sq.ft'', ''https://linkedin.com'', ''12 Marina Boulevard'', ''San Diego, CA'', 3200000000000, ''USD'', 4, ''System'', ''System'', ''MANUAL'', ''MANUAL'', NOW(), NOW()),
                    (%L, ''Harmony Heights 3BHK Residence'', ''Apartment • For Sale • Available'', ''https://realestate-crm.internal/listings/harmony-heights-3bhk'', ''$780,000 • 3 Bed / 3 Bath • 1,850 Sq.ft'', ''https://linkedin.com'', ''55 Pinecrest Lane, Apt 8B'', ''Seattle, WA'', 780000000000, ''USD'', 5, ''System'', ''System'', ''MANUAL'', ''MANUAL'', NOW(), NOW()),
                    (%L, ''Silicon Square Tech Hub Unit 10'', ''Commercial • For Sale • Under Contract'', ''https://realestate-crm.internal/listings/silicon-square-10'', ''$1,850,000 • Commercial Tech Hub • 4,100 Sq.ft'', ''https://linkedin.com'', ''1020 Innovation Drive, Unit 10'', ''San Jose, CA'', 1850000000000, ''USD'', 6, ''System'', ''System'', ''MANUAL'', ''MANUAL'', NOW(), NOW()),
                    (%L, ''Greenfield Premium Villa Plot 18'', ''Plot • For Sale • Available'', ''https://realestate-crm.internal/listings/greenfield-plot-18'', ''$450,000 • Residential Plot • 10,000 Sq.ft'', ''https://linkedin.com'', ''Sector 8 Eco Valley, Plot 18'', ''Denver, CO'', 450000000000, ''USD'', 7, ''System'', ''System'', ''MANUAL'', ''MANUAL'', NOW(), NOW())
            ', db_schema, prop1, prop2, prop3, prop4, prop5, prop6, prop7, prop8);

            -- B. Buyers & Leads (person) - 8 Leads
            EXECUTE format('
                INSERT INTO %I.person (
                    id, "nameFirstName", "nameLastName", "emailsPrimaryEmail", "phonesPrimaryPhoneNumber", "jobTitle", "companyId",
                    position, "createdByName", "updatedByName", "createdBySource", "updatedBySource", "createdAt", "updatedAt"
                ) VALUES
                    (%L, ''Alexander'', ''Wright'', ''alexander.wright@luxurybuyer.com'', ''+1 (415) 890-1234'', ''Buyer: Luxury Penthouse ($2.4M) • Source: Ads • Pre-approved • Location: San Francisco, CA'', %L, 0, ''System'', ''System'', ''MANUAL'', ''MANUAL'', NOW(), NOW()),
                    (%L, ''Sophia'', ''Martinez'', ''sophia.m@fintechcorp.io'', ''+1 (512) 674-8891'', ''Buyer: Luxury Villa ($1.6M) • Source: Website • Financing Ready • Location: Austin, TX'', %L, 1, ''System'', ''System'', ''MANUAL'', ''MANUAL'', NOW(), NOW()),
                    (%L, ''Devin'', ''Chen'', ''devin.chen@chenholdings.com'', ''+1 (212) 555-0199'', ''Tenant: Commercial Plaza ($10K/mo) • Source: Referral • Corporate Lease • Location: New York, NY'', %L, 2, ''System'', ''System'', ''MANUAL'', ''MANUAL'', NOW(), NOW()),
                    (%L, ''Priya'', ''Sharma'', ''priya.sharma@medresearch.org'', ''+1 (305) 781-4432'', ''Tenant: Luxury Apt ($5K/mo) • Source: Walk-in • Relocating • Location: Miami, FL'', %L, 3, ''System'', ''System'', ''MANUAL'', ''MANUAL'', NOW(), NOW()),
                    (%L, ''Michael'', ''O''''Connor'', ''m.oconnor@investments.com'', ''+1 (619) 402-9981'', ''Buyer: Waterfront Villa ($3.2M) • Source: Website • Cash Buyer • Location: San Diego, CA'', %L, 4, ''System'', ''System'', ''MANUAL'', ''MANUAL'', NOW(), NOW()),
                    (%L, ''Rachel'', ''Green'', ''rachel.green@fashionexec.com'', ''+1 (206) 912-7743'', ''Buyer: 3BHK Residence ($780K) • Source: Ads • First-time Buyer • Location: Seattle, WA'', %L, 5, ''System'', ''System'', ''MANUAL'', ''MANUAL'', NOW(), NOW()),
                    (%L, ''Vikram'', ''Patel'', ''vikram.patel@greentech.com'', ''+1 (408) 332-1109'', ''Buyer: Commercial Hub ($1.8M) • Source: Referral • Tech Expansion • Location: San Jose, CA'', %L, 6, ''System'', ''System'', ''MANUAL'', ''MANUAL'', NOW(), NOW()),
                    (%L, ''Emma'', ''Watson'', ''emma.watson@designstudio.net'', ''+1 (303) 844-6621'', ''Buyer: Eco Villa Plot ($450K) • Source: Website • Immediate Build • Location: Denver, CO'', %L, 7, ''System'', ''System'', ''MANUAL'', ''MANUAL'', NOW(), NOW())
            ', db_schema, lead1, prop1, lead2, prop2, lead3, prop4, lead4, prop3, lead5, prop5, lead6, prop6, lead7, prop7, lead8, prop8);

            -- C. Site Visits (note table & noteTarget relations) - 8 Site Visits
            EXECUTE format('
                INSERT INTO %I.note (
                    id, title, "bodyV2Markdown",
                    position, "createdByName", "updatedByName", "createdBySource", "updatedBySource", "createdAt", "updatedAt"
                ) VALUES
                    (%L, ''Site Visit: Alexander Wright @ Skyline Grand Penthouse'', ''Visit Details:\n• Buyer: Alexander Wright (Pre-approved up to $3M)\n• Property: Skyline Grand Penthouse (Floor 42, 4,800 Sq.ft)\n• Date & Time: Oct 30, 2026 at 10:30 AM\n• Status: Scheduled\n• Assigned Agent: Marcus Vance\n• Feedback & Agenda: Private sunset terrace tour and private elevator key inspection.\n• Next Action Date: Nov 01, 2026 (Draft formal purchase agreement)'', 0, ''System'', ''System'', ''MANUAL'', ''MANUAL'', NOW(), NOW()),
                    (%L, ''Site Visit: Sophia Martinez @ Emerald Valley Luxury Villa 4B'', ''Visit Details:\n• Buyer: Sophia Martinez (Financing approved via Silicon Valley Bank)\n• Property: Emerald Valley Luxury Villa 4B (3,950 Sq.ft)\n• Date & Time: Oct 28, 2026 at 2:00 PM\n• Status: Completed\n• Assigned Agent: Elena Rostova\n• Feedback & Notes: Buyer loved the landscaped courtyard and modern European kitchen. Preparing purchase offer at $1.62M.\n• Next Action Date: Oct 29, 2026 (Submit counter-offer documents)'', 1, ''System'', ''System'', ''MANUAL'', ''MANUAL'', NOW(), NOW()),
                    (%L, ''Site Visit: Devin Chen @ Oasis Commercial Plaza Suite 300'', ''Visit Details:\n• Buyer: Devin Chen (Chen Holdings LLC)\n• Property: Oasis Commercial Plaza Suite 300 (3,200 Sq.ft)\n• Date & Time: Oct 29, 2026 at 11:00 AM\n• Status: Scheduled\n• Assigned Agent: Marcus Vance\n• Feedback & Notes: Inspection for 45 tech workstations and server room cooling capacity.\n• Next Action Date: Nov 03, 2026 (Tenant Improvement budget agreement)'', 2, ''System'', ''System'', ''MANUAL'', ''MANUAL'', NOW(), NOW()),
                    (%L, ''Site Visit: Priya Sharma @ Grand Horizon Residences Apt 1204'', ''Visit Details:\n• Buyer: Dr. Priya Sharma\n• Property: Grand Horizon Residences Apt 1204 (1,350 Sq.ft)\n• Date & Time: Oct 27, 2026 at 4:30 PM\n• Status: Completed\n• Assigned Agent: Carlos Morales\n• Feedback & Notes: Verified unobstructed ocean view and allocated EV parking stalls. Submitted annual rental application.\n• Next Action Date: Oct 29, 2026 (Execute digital lease signing)'', 3, ''System'', ''System'', ''MANUAL'', ''MANUAL'', NOW(), NOW()),
                    (%L, ''Site Visit: Michael O''''Connor @ Sunset Bay Waterfront Villa'', ''Visit Details:\n• Buyer: Michael O''''Connor (Private Equity)\n• Property: Sunset Bay Waterfront Villa (5,600 Sq.ft with Private Boat Slip)\n• Date & Time: Oct 25, 2026 at 1:00 PM\n• Status: Completed\n• Assigned Agent: Marcus Vance\n• Feedback & Notes: Comprehensive structural and boat dock inspection passed with buyer architect. Offer of $3.15M accepted!\n• Next Action Date: Oct 28, 2026 (Wire escrow deposit)'', 4, ''System'', ''System'', ''MANUAL'', ''MANUAL'', NOW(), NOW()),
                    (%L, ''Site Visit: Rachel Green @ Harmony Heights 3BHK Residence'', ''Visit Details:\n• Buyer: Rachel Green\n• Property: Harmony Heights 3BHK (1,850 Sq.ft)\n• Date & Time: Nov 02, 2026 at 3:00 PM\n• Status: Scheduled\n• Assigned Agent: Elena Rostova\n• Feedback & Notes: First-time home buyer visit with family. Requested floor plan measurements and HOA bylaws.\n• Next Action Date: Nov 04, 2026 (Mortgage pre-approval verification)'', 5, ''System'', ''System'', ''MANUAL'', ''MANUAL'', NOW(), NOW()),
                    (%L, ''Site Visit: Vikram Patel @ Silicon Square Tech Hub Unit 10'', ''Visit Details:\n• Buyer: Vikram Patel (GreenTech Solutions)\n• Property: Silicon Square Tech Hub Unit 10 (4,100 Sq.ft)\n• Date & Time: Oct 24, 2026 at 10:00 AM\n• Status: Completed\n• Assigned Agent: Carlos Morales\n• Feedback & Notes: Commercial zoning and high-speed dedicated fiber connection verified. Buyer moving to negotiation stage.\n• Next Action Date: Oct 30, 2026 (Letter of Intent review)'', 6, ''System'', ''System'', ''MANUAL'', ''MANUAL'', NOW(), NOW()),
                    (%L, ''Site Visit: Emma Watson @ Greenfield Premium Villa Plot 18'', ''Visit Details:\n• Buyer: Emma Watson\n• Property: Greenfield Premium Villa Plot 18 (10,000 Sq.ft Plot)\n• Date & Time: Oct 31, 2026 at 11:30 AM\n• Status: Scheduled\n• Assigned Agent: Elena Rostova\n• Feedback & Notes: Soil test geotechnical report and boundary topographical survey to be provided during visit.\n• Next Action Date: Nov 02, 2026 (Architect design feasibility review)'', 7, ''System'', ''System'', ''MANUAL'', ''MANUAL'', NOW(), NOW())
            ', db_schema, vis1, vis2, vis3, vis4, vis5, vis6, vis7, vis8);

            -- Relations: Buyers & Leads -> Site Visits & Property Listings -> Site Visits
            EXECUTE format('
                INSERT INTO %I."noteTarget" (
                    id, "noteId", "targetPersonId", "targetCompanyId",
                    position, "createdByName", "updatedByName", "createdBySource", "updatedBySource", "createdAt", "updatedAt"
                ) VALUES
                    (gen_random_uuid(), %L, %L, %L, 0, ''System'', ''System'', ''MANUAL'', ''MANUAL'', NOW(), NOW()),
                    (gen_random_uuid(), %L, %L, %L, 1, ''System'', ''System'', ''MANUAL'', ''MANUAL'', NOW(), NOW()),
                    (gen_random_uuid(), %L, %L, %L, 2, ''System'', ''System'', ''MANUAL'', ''MANUAL'', NOW(), NOW()),
                    (gen_random_uuid(), %L, %L, %L, 3, ''System'', ''System'', ''MANUAL'', ''MANUAL'', NOW(), NOW()),
                    (gen_random_uuid(), %L, %L, %L, 4, ''System'', ''System'', ''MANUAL'', ''MANUAL'', NOW(), NOW()),
                    (gen_random_uuid(), %L, %L, %L, 5, ''System'', ''System'', ''MANUAL'', ''MANUAL'', NOW(), NOW()),
                    (gen_random_uuid(), %L, %L, %L, 6, ''System'', ''System'', ''MANUAL'', ''MANUAL'', NOW(), NOW()),
                    (gen_random_uuid(), %L, %L, %L, 7, ''System'', ''System'', ''MANUAL'', ''MANUAL'', NOW(), NOW())
            ', db_schema, vis1, lead1, prop1, vis2, lead2, prop2, vis3, lead3, prop4, vis4, lead4, prop3, vis5, lead5, prop5, vis6, lead6, prop6, vis7, lead7, prop7, vis8, lead8, prop8);

            -- D. Deals (opportunity) - 8 Deals
            EXECUTE format('
                INSERT INTO %I.opportunity (
                    id, name, "amountAmountMicros", "amountCurrencyCode", stage, "closeDate", "companyId", "pointOfContactId",
                    position, "createdByName", "updatedByName", "createdBySource", "updatedBySource", "createdAt", "updatedAt"
                ) VALUES
                    (%L, ''Deal: Skyline Grand Penthouse Purchase - Alexander Wright'', 2400000000000, ''USD'', ''NEGOTIATION'', NOW() + interval ''21 days'', %L, %L, 0, ''System'', ''System'', ''MANUAL'', ''MANUAL'', NOW(), NOW()),
                    (%L, ''Deal: Emerald Valley Villa 4B Acquisition - Sophia Martinez'', 1620000000000, ''USD'', ''DOCUMENTATION'', NOW() + interval ''14 days'', %L, %L, 1, ''System'', ''System'', ''MANUAL'', ''MANUAL'', NOW(), NOW()),
                    (%L, ''Deal: Oasis Commercial Plaza 5-Year Lease - Devin Chen'', 105000000000, ''USD'', ''NEW_DEAL'', NOW() + interval ''30 days'', %L, %L, 2, ''System'', ''System'', ''MANUAL'', ''MANUAL'', NOW(), NOW()),
                    (%L, ''Deal: Grand Horizon Apt 1204 Annual Lease - Priya Sharma'', 57600000000, ''USD'', ''DOCUMENTATION'', NOW() + interval ''7 days'', %L, %L, 3, ''System'', ''System'', ''MANUAL'', ''MANUAL'', NOW(), NOW()),
                    (%L, ''Deal: Sunset Bay Waterfront Villa Closing - Michael O''''Connor'', 3150000000000, ''USD'', ''CLOSED_WON'', NOW() - interval ''2 days'', %L, %L, 4, ''System'', ''System'', ''MANUAL'', ''MANUAL'', NOW(), NOW()),
                    (%L, ''Deal: Harmony Heights 3BHK Initial Offer - Rachel Green'', 765000000000, ''USD'', ''NEW_DEAL'', NOW() + interval ''28 days'', %L, %L, 5, ''System'', ''System'', ''MANUAL'', ''MANUAL'', NOW(), NOW()),
                    (%L, ''Deal: Silicon Square Tech Hub Acquisition - Vikram Patel'', 1800000000000, ''USD'', ''NEGOTIATION'', NOW() + interval ''18 days'', %L, %L, 6, ''System'', ''System'', ''MANUAL'', ''MANUAL'', NOW(), NOW()),
                    (%L, ''Deal: Greenfield Villa Plot 18 Contract - Emma Watson'', 440000000000, ''USD'', ''NEW_DEAL'', NOW() + interval ''45 days'', %L, %L, 7, ''System'', ''System'', ''MANUAL'', ''MANUAL'', NOW(), NOW())
            ', db_schema, deal1, prop1, lead1, deal2, prop2, lead2, deal3, prop4, lead3, deal4, prop3, lead4, deal5, prop5, lead5, deal6, prop6, lead6, deal7, prop7, lead7, deal8, prop8, lead8);

            -- E. Follow-ups (task table & taskTarget relations) - 8 Tasks
            EXECUTE format('
                INSERT INTO %I.task (
                    id, title, "bodyV2Markdown", status, "dueAt",
                    position, "createdByName", "updatedByName", "createdBySource", "updatedBySource", "createdAt", "updatedAt"
                ) VALUES
                    (%L, ''Call: Alexander Wright - Counter-offer review on penthouse deed & escrow timeline'', ''Counter-offer review on penthouse deed & escrow timeline'', ''TODO'', NOW() + interval ''1 day'', 0, ''System'', ''System'', ''MANUAL'', ''MANUAL'', NOW(), NOW()),
                    (%L, ''Meeting: Sophia Martinez - Finalize title deed documentation & notary appointment'', ''Finalize title deed documentation & notary appointment'', ''TODO'', NOW() + interval ''2 days'', 1, ''System'', ''System'', ''MANUAL'', ''MANUAL'', NOW(), NOW()),
                    (%L, ''Message: Devin Chen - Send revised commercial lease with tenant improvement allowance'', ''Send revised commercial lease with tenant improvement allowance'', ''TODO'', NOW() + interval ''3 days'', 2, ''System'', ''System'', ''MANUAL'', ''MANUAL'', NOW(), NOW()),
                    (%L, ''Email: Priya Sharma - Send digital lease agreement & security deposit payment link'', ''Send digital lease agreement & security deposit payment link'', ''DONE'', NOW() - interval ''1 day'', 3, ''System'', ''System'', ''MANUAL'', ''MANUAL'', NOW(), NOW()),
                    (%L, ''Meeting: Michael O''''Connor - Handover villa keys and smart home access credentials'', ''Handover villa keys and smart home access credentials'', ''DONE'', NOW() - interval ''2 days'', 4, ''System'', ''System'', ''MANUAL'', ''MANUAL'', NOW(), NOW()),
                    (%L, ''Call: Rachel Green - Confirm pre-approval letter from Chase Mortgage'', ''Confirm pre-approval letter from Chase Mortgage'', ''TODO'', NOW() + interval ''4 days'', 5, ''System'', ''System'', ''MANUAL'', ''MANUAL'', NOW(), NOW()),
                    (%L, ''Email: Vikram Patel - Provide commercial environmental clearance certificate'', ''Provide commercial environmental clearance certificate'', ''IN_PROGRESS'', NOW() + interval ''2 days'', 6, ''System'', ''System'', ''MANUAL'', ''MANUAL'', NOW(), NOW()),
                    (%L, ''Call: Emma Watson - Coordinate site survey engineer for plot boundary demarcation'', ''Coordinate site survey engineer for plot boundary demarcation'', ''TODO'', NOW() + interval ''5 days'', 7, ''System'', ''System'', ''MANUAL'', ''MANUAL'', NOW(), NOW())
            ', db_schema, fu1, fu2, fu3, fu4, fu5, fu6, fu7, fu8);

            -- Relations: Buyers & Leads -> Follow-ups, Property Listings -> Follow-ups, Deals -> Follow-ups
            EXECUTE format('
                INSERT INTO %I."taskTarget" (
                    id, "taskId", "targetPersonId", "targetCompanyId", "targetOpportunityId",
                    position, "createdByName", "updatedByName", "createdBySource", "updatedBySource", "createdAt", "updatedAt"
                ) VALUES
                    (gen_random_uuid(), %L, %L, %L, %L, 0, ''System'', ''System'', ''MANUAL'', ''MANUAL'', NOW(), NOW()),
                    (gen_random_uuid(), %L, %L, %L, %L, 1, ''System'', ''System'', ''MANUAL'', ''MANUAL'', NOW(), NOW()),
                    (gen_random_uuid(), %L, %L, %L, %L, 2, ''System'', ''System'', ''MANUAL'', ''MANUAL'', NOW(), NOW()),
                    (gen_random_uuid(), %L, %L, %L, %L, 3, ''System'', ''System'', ''MANUAL'', ''MANUAL'', NOW(), NOW()),
                    (gen_random_uuid(), %L, %L, %L, %L, 4, ''System'', ''System'', ''MANUAL'', ''MANUAL'', NOW(), NOW()),
                    (gen_random_uuid(), %L, %L, %L, %L, 5, ''System'', ''System'', ''MANUAL'', ''MANUAL'', NOW(), NOW()),
                    (gen_random_uuid(), %L, %L, %L, %L, 6, ''System'', ''System'', ''MANUAL'', ''MANUAL'', NOW(), NOW()),
                    (gen_random_uuid(), %L, %L, %L, %L, 7, ''System'', ''System'', ''MANUAL'', ''MANUAL'', NOW(), NOW())
            ', db_schema, fu1, lead1, prop1, deal1, fu2, lead2, prop2, deal2, fu3, lead3, prop4, deal3, fu4, lead4, prop3, deal4, fu5, lead5, prop5, deal5, fu6, lead6, prop6, deal6, fu7, lead7, prop7, deal7, fu8, lead8, prop8, deal8);

            -- F. Reports (dashboard table) - 6 Analytics Reports
            EXECUTE format('
                INSERT INTO %I.dashboard (
                    id, title,
                    position, "createdByName", "updatedByName", "createdBySource", "updatedBySource", "createdAt", "updatedAt"
                ) VALUES
                    (%L, ''Total Active Property Listings: 8 Properties ($10.8M Portfolio Value, 75%%%% Available / Reserved)'', 0, ''System'', ''System'', ''MANUAL'', ''MANUAL'', NOW(), NOW()),
                    (%L, ''New Leads by Source: Website (38%%%%), Ads (29%%%%), Referrals (25%%%%), Walk-in (8%%%%)'', 1, ''System'', ''System'', ''MANUAL'', ''MANUAL'', NOW(), NOW()),
                    (%L, ''Upcoming & Completed Site Visits: 84%%%% Attendance Rate, 62%%%% Conversion to Deal Negotiation'', 2, ''System'', ''System'', ''MANUAL'', ''MANUAL'', NOW(), NOW()),
                    (%L, ''Deals by Pipeline Stage: $8.9M in Active Negotiations, $3.15M Closed Won This Quarter'', 3, ''System'', ''System'', ''MANUAL'', ''MANUAL'', NOW(), NOW()),
                    (%L, ''Closed Sales & Rental Deals: Average Time-to-Close 28 Days, Average Commission 4.8%%%%'', 4, ''System'', ''System'', ''MANUAL'', ''MANUAL'', NOW(), NOW()),
                    (%L, ''Agent Performance & Follow-up Compliance: 94%%%% On-time Resolution Across All Brokers'', 5, ''System'', ''System'', ''MANUAL'', ''MANUAL'', NOW(), NOW())
            ', db_schema, rep1, rep2, rep3, rep4, rep5, rep6);
        END IF;

        -- 6. Update Workspace metadataVersion to invalidate frontend cache
        UPDATE core.workspace
        SET "metadataVersion" = "metadataVersion" + 1
        WHERE id = ws_id;

        RAISE NOTICE 'Real Estate CRM Provisioning and Seeding Completed Successfully for Workspace %!', ws_id;
    END LOOP;
END $$;
