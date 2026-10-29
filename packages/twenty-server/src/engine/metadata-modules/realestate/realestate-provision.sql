-- ============================================================================
-- REAL ESTATE CRM WORKSPACE METADATA PROVISIONING SCRIPT
-- ============================================================================
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
    opp_stage_field_id UUID;
    deal_kanban_view_id UUID;
    lead_kanban_view_id UUID;
BEGIN
    FOR ws_rec IN SELECT id, "databaseSchema" FROM core.workspace WHERE "deletedAt" IS NULL LOOP
        ws_id := ws_rec.id;
        db_schema := ws_rec."databaseSchema";

        -- Fetch or Create Application ID
        SELECT id INTO app_id FROM core."application" WHERE "workspaceId" = ws_id LIMIT 1;
        IF app_id IS NULL THEN
            app_id := gen_random_uuid();
            INSERT INTO core."application" (id, "workspaceId", "createdAt", "updatedAt")
            VALUES (app_id, ws_id, NOW(), NOW());
        END IF;

        -- 1. Update Core Object Metadata Labels and Icons to Pure Real Estate
        UPDATE core."objectMetadata"
        SET "labelPlural" = 'Property Listings', "labelSingular" = 'Property Listing', icon = 'IconBuildingSkyscraper', color = 'turquoise', "isActive" = true
        WHERE "workspaceId" = ws_id AND "nameSingular" = 'company';

        UPDATE core."objectMetadata"
        SET "labelPlural" = 'Buyers & Leads', "labelSingular" = 'Buyer & Lead', icon = 'IconUserCheck', color = 'blue', "isActive" = true
        WHERE "workspaceId" = ws_id AND "nameSingular" = 'person';

        UPDATE core."objectMetadata"
        SET "labelPlural" = 'Site Visits', "labelSingular" = 'Site Visit', icon = 'IconCalendarEvent', color = 'sky', "isActive" = true
        WHERE "workspaceId" = ws_id AND "nameSingular" = 'note';

        UPDATE core."objectMetadata"
        SET "labelPlural" = 'Deals', "labelSingular" = 'Deal', icon = 'IconCurrencyDollar', color = 'green', "isActive" = true
        WHERE "workspaceId" = ws_id AND "nameSingular" = 'opportunity';

        UPDATE core."objectMetadata"
        SET "labelPlural" = 'Follow-ups', "labelSingular" = 'Follow-up', icon = 'IconPhoneCall', color = 'orange', "isActive" = true
        WHERE "workspaceId" = ws_id AND "nameSingular" = 'task';

        UPDATE core."objectMetadata"
        SET "labelPlural" = 'Reports', "labelSingular" = 'Report', icon = 'IconChartPie', color = 'purple', "isActive" = true
        WHERE "workspaceId" = ws_id AND "nameSingular" = 'dashboard';

        -- Fetch Object IDs
        SELECT id INTO comp_obj_id FROM core."objectMetadata" WHERE "workspaceId" = ws_id AND "nameSingular" = 'company';
        SELECT id INTO person_obj_id FROM core."objectMetadata" WHERE "workspaceId" = ws_id AND "nameSingular" = 'person';
        SELECT id INTO note_obj_id FROM core."objectMetadata" WHERE "workspaceId" = ws_id AND "nameSingular" = 'note';
        SELECT id INTO opp_obj_id FROM core."objectMetadata" WHERE "workspaceId" = ws_id AND "nameSingular" = 'opportunity';
        SELECT id INTO task_obj_id FROM core."objectMetadata" WHERE "workspaceId" = ws_id AND "nameSingular" = 'task';
        SELECT id INTO dash_obj_id FROM core."objectMetadata" WHERE "workspaceId" = ws_id AND "nameSingular" = 'dashboard';

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

        -- 3. Configure Sidebar Navigation Menu
        DELETE FROM core."navigationMenuItem" WHERE "workspaceId" = ws_id;

        INSERT INTO core."navigationMenuItem" (id, "universalIdentifier", "workspaceId", "applicationId", "targetObjectMetadataId", position, type, color, icon, name, "createdAt", "updatedAt")
        VALUES
            (gen_random_uuid(), gen_random_uuid(), ws_id, app_id, comp_obj_id, 0, 'OBJECT', 'turquoise', 'IconBuildingSkyscraper', 'Property Listings', NOW(), NOW()),
            (gen_random_uuid(), gen_random_uuid(), ws_id, app_id, person_obj_id, 1, 'OBJECT', 'blue', 'IconUserCheck', 'Buyers & Leads', NOW(), NOW()),
            (gen_random_uuid(), gen_random_uuid(), ws_id, app_id, note_obj_id, 2, 'OBJECT', 'sky', 'IconCalendarEvent', 'Site Visits', NOW(), NOW()),
            (gen_random_uuid(), gen_random_uuid(), ws_id, app_id, opp_obj_id, 3, 'OBJECT', 'green', 'IconCurrencyDollar', 'Deals', NOW(), NOW()),
            (gen_random_uuid(), gen_random_uuid(), ws_id, app_id, task_obj_id, 4, 'OBJECT', 'orange', 'IconPhoneCall', 'Follow-ups', NOW(), NOW()),
            (gen_random_uuid(), gen_random_uuid(), ws_id, app_id, dash_obj_id, 5, 'OBJECT', 'purple', 'IconChartPie', 'Reports', NOW(), NOW());

        -- 4. Invalidate Metadata Cache
        UPDATE core.workspace SET "metadataVersion" = "metadataVersion" + 1 WHERE id = ws_id;
    END LOOP;
END $$;
