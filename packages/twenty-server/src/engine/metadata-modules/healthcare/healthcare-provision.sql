-- ============================================================================
-- HEALTHCARE CRM COMPLETE WORKSPACE PROVISIONING & MIGRATION SCRIPT
-- ============================================================================
DO $$
DECLARE
    ws_rec RECORD;
    app_id UUID;
    person_obj_id UUID;
    opp_obj_id UUID;
    comp_obj_id UUID;
    task_obj_id UUID;
    dash_obj_id UUID;
    member_obj_id UUID;
    opp_stage_field_id UUID;
    appt_mgmt_view_id UUID;
    pat_acq_view_id UUID;
BEGIN
    FOR ws_rec IN SELECT id FROM core."workspace" WHERE "deletedAt" IS NULL LOOP
        RAISE NOTICE 'Provisioning Healthcare CRM for Workspace: %', ws_rec.id;

        -- 0. Get Application ID
        SELECT id INTO app_id FROM core."application" WHERE "workspaceId" = ws_rec.id LIMIT 1;
        IF app_id IS NULL THEN
            app_id := gen_random_uuid();
            INSERT INTO core."application" (id, "workspaceId", "createdAt", "updatedAt")
            VALUES (app_id, ws_rec.id, NOW(), NOW());
        END IF;

        -- 1. Update Core Object Metadata Labels and Icons
        UPDATE core."objectMetadata"
        SET "labelPlural" = 'Patients', "labelSingular" = 'Patient', icon = 'IconHeartbeat'
        WHERE "workspaceId" = ws_rec.id AND "nameSingular" = 'person';

        UPDATE core."objectMetadata"
        SET "labelPlural" = 'Appointments', "labelSingular" = 'Appointment', icon = 'IconCalendarEvent'
        WHERE "workspaceId" = ws_rec.id AND "nameSingular" = 'opportunity';

        UPDATE core."objectMetadata"
        SET "labelPlural" = 'Departments', "labelSingular" = 'Department', icon = 'IconBuildingHospital'
        WHERE "workspaceId" = ws_rec.id AND "nameSingular" = 'company';

        UPDATE core."objectMetadata"
        SET "labelPlural" = 'Follow-ups', "labelSingular" = 'Follow-up', icon = 'IconCalendarCheck'
        WHERE "workspaceId" = ws_rec.id AND "nameSingular" = 'task';

        UPDATE core."objectMetadata"
        SET "labelPlural" = 'Reports', "labelSingular" = 'Report', icon = 'IconChartBar'
        WHERE "workspaceId" = ws_rec.id AND "nameSingular" = 'dashboard';

        UPDATE core."objectMetadata"
        SET "labelPlural" = 'Doctors', "labelSingular" = 'Doctor', icon = 'IconUserCheck'
        WHERE "workspaceId" = ws_rec.id AND "nameSingular" = 'workspaceMember';

        -- Get Object IDs
        SELECT id INTO person_obj_id FROM core."objectMetadata" WHERE "workspaceId" = ws_rec.id AND "nameSingular" = 'person';
        SELECT id INTO opp_obj_id FROM core."objectMetadata" WHERE "workspaceId" = ws_rec.id AND "nameSingular" = 'opportunity';
        SELECT id INTO comp_obj_id FROM core."objectMetadata" WHERE "workspaceId" = ws_rec.id AND "nameSingular" = 'company';
        SELECT id INTO task_obj_id FROM core."objectMetadata" WHERE "workspaceId" = ws_rec.id AND "nameSingular" = 'task';
        SELECT id INTO dash_obj_id FROM core."objectMetadata" WHERE "workspaceId" = ws_rec.id AND "nameSingular" = 'dashboard';
        SELECT id INTO member_obj_id FROM core."objectMetadata" WHERE "workspaceId" = ws_rec.id AND "nameSingular" = 'workspaceMember';

        -- 2. Configure Appointment Stages (Appointment Management & Patient Acquisition Pipelines)
        SELECT id INTO opp_stage_field_id FROM core."fieldMetadata"
        WHERE "objectMetadataId" = opp_obj_id AND name = 'stage';

        UPDATE core."fieldMetadata"
        SET options = '[
            {"id": "20202020-0001-4afd-9c39-d2063097587a", "color": "yellow", "label": "Requested", "value": "REQUESTED", "position": 0},
            {"id": "20202020-0002-4671-ac32-26d304dacb6e", "color": "blue", "label": "Confirmed", "value": "CONFIRMED", "position": 1},
            {"id": "20202020-0003-4acc-b5ca-f6531a8ecb4a", "color": "purple", "label": "Checked In", "value": "CHECKED_IN", "position": 2},
            {"id": "20202020-0004-4f6b-91bc-f413e9b2f654", "color": "green", "label": "Completed", "value": "COMPLETED", "position": 3},
            {"id": "20202020-0005-4a6f-a8b2-774bbad21104", "color": "red", "label": "Cancelled", "value": "CANCELLED", "position": 4},
            {"id": "20202020-0006-4a6f-a8b2-774bbad21105", "color": "gray", "label": "No-show", "value": "NO_SHOW", "position": 5},
            {"id": "20202020-8e01-4afd-9c39-d2063097587a", "color": "sky", "label": "New Inquiry", "value": "NEW_INQUIRY", "position": 6},
            {"id": "20202020-e685-4671-ac32-26d304dacb6e", "color": "orange", "label": "Contacted", "value": "CONTACTED", "position": 7},
            {"id": "20202020-dde9-4acc-b5ca-f6531a8ecb4a", "color": "turquoise", "label": "Appointment Booked", "value": "APPOINTMENT_BOOKED", "position": 8},
            {"id": "20202020-696e-4f6b-91bc-f413e9b2f654", "color": "teal", "label": "Converted", "value": "CONVERTED", "position": 9},
            {"id": "20202020-0bb5-4a6f-a8b2-774bbad21104", "color": "red", "label": "Lost", "value": "LOST", "position": 10}
        ]'::jsonb
        WHERE id = opp_stage_field_id;

        -- 3. Configure Healthcare Pipeline Views
        -- Check / Configure Appointment Management Kanban View
        SELECT id INTO appt_mgmt_view_id FROM core."view"
        WHERE "objectMetadataId" = opp_obj_id AND type = 'KANBAN' LIMIT 1;

        IF appt_mgmt_view_id IS NOT NULL THEN
            UPDATE core."view"
            SET name = 'Appointment Management Pipeline',
                "mainGroupByFieldMetadataId" = opp_stage_field_id,
                icon = 'IconCalendarEvent'
            WHERE id = appt_mgmt_view_id;
        ELSE
            appt_mgmt_view_id := gen_random_uuid();
            INSERT INTO core."view" (
                id, "universalIdentifier", name, "objectMetadataId", type, icon, position,
                "workspaceId", "applicationId", "mainGroupByFieldMetadataId", "createdAt", "updatedAt"
            ) VALUES (
                appt_mgmt_view_id, gen_random_uuid(), 'Appointment Management Pipeline', opp_obj_id, 'KANBAN',
                'IconCalendarEvent', 1, ws_rec.id, app_id, opp_stage_field_id, NOW(), NOW()
            );
        END IF;

        -- Check / Configure Patient Acquisition Kanban View
        SELECT id INTO pat_acq_view_id FROM core."view"
        WHERE "objectMetadataId" = opp_obj_id AND name = 'Patient Acquisition Pipeline' LIMIT 1;

        IF pat_acq_view_id IS NULL THEN
            pat_acq_view_id := gen_random_uuid();
            INSERT INTO core."view" (
                id, "universalIdentifier", name, "objectMetadataId", type, icon, position,
                "workspaceId", "applicationId", "mainGroupByFieldMetadataId", "createdAt", "updatedAt"
            ) VALUES (
                pat_acq_view_id, gen_random_uuid(), 'Patient Acquisition Pipeline', opp_obj_id, 'KANBAN',
                'IconUserSearch', 2, ws_rec.id, app_id, opp_stage_field_id, NOW(), NOW()
            );
        END IF;

        -- Seed View Groups for Appointment Management Pipeline
        DELETE FROM core."viewGroup" WHERE "viewId" = appt_mgmt_view_id;
        INSERT INTO core."viewGroup" (id, "universalIdentifier", "viewId", "fieldValue", "isVisible", position, "workspaceId", "applicationId", "createdAt", "updatedAt")
        VALUES
            (gen_random_uuid(), gen_random_uuid(), appt_mgmt_view_id, 'REQUESTED', true, 0, ws_rec.id, app_id, NOW(), NOW()),
            (gen_random_uuid(), gen_random_uuid(), appt_mgmt_view_id, 'CONFIRMED', true, 1, ws_rec.id, app_id, NOW(), NOW()),
            (gen_random_uuid(), gen_random_uuid(), appt_mgmt_view_id, 'CHECKED_IN', true, 2, ws_rec.id, app_id, NOW(), NOW()),
            (gen_random_uuid(), gen_random_uuid(), appt_mgmt_view_id, 'COMPLETED', true, 3, ws_rec.id, app_id, NOW(), NOW()),
            (gen_random_uuid(), gen_random_uuid(), appt_mgmt_view_id, 'CANCELLED', true, 4, ws_rec.id, app_id, NOW(), NOW()),
            (gen_random_uuid(), gen_random_uuid(), appt_mgmt_view_id, 'NO_SHOW', true, 5, ws_rec.id, app_id, NOW(), NOW());

        -- Seed View Groups for Patient Acquisition Pipeline
        DELETE FROM core."viewGroup" WHERE "viewId" = pat_acq_view_id;
        INSERT INTO core."viewGroup" (id, "universalIdentifier", "viewId", "fieldValue", "isVisible", position, "workspaceId", "applicationId", "createdAt", "updatedAt")
        VALUES
            (gen_random_uuid(), gen_random_uuid(), pat_acq_view_id, 'NEW_INQUIRY', true, 0, ws_rec.id, app_id, NOW(), NOW()),
            (gen_random_uuid(), gen_random_uuid(), pat_acq_view_id, 'CONTACTED', true, 1, ws_rec.id, app_id, NOW(), NOW()),
            (gen_random_uuid(), gen_random_uuid(), pat_acq_view_id, 'APPOINTMENT_BOOKED', true, 2, ws_rec.id, app_id, NOW(), NOW()),
            (gen_random_uuid(), gen_random_uuid(), pat_acq_view_id, 'CONVERTED', true, 3, ws_rec.id, app_id, NOW(), NOW()),
            (gen_random_uuid(), gen_random_uuid(), pat_acq_view_id, 'LOST', true, 4, ws_rec.id, app_id, NOW(), NOW());

        -- Update Table Views
        UPDATE core."view"
        SET name = 'All Appointments', icon = 'IconCalendarEvent'
        WHERE "objectMetadataId" = opp_obj_id AND type = 'TABLE' AND key = 'INDEX';

        UPDATE core."view"
        SET name = 'All Patients', icon = 'IconHeartbeat'
        WHERE "objectMetadataId" = person_obj_id AND type = 'TABLE' AND key = 'INDEX';

        UPDATE core."view"
        SET name = 'All Departments', icon = 'IconBuildingHospital'
        WHERE "objectMetadataId" = comp_obj_id AND type = 'TABLE';

        UPDATE core."view"
        SET name = 'All Follow-ups', icon = 'IconCalendarCheck'
        WHERE "objectMetadataId" = task_obj_id AND type = 'TABLE' AND key = 'INDEX';

        UPDATE core."view"
        SET name = 'Clinical Reports & Summaries', icon = 'IconChartBar'
        WHERE "objectMetadataId" = dash_obj_id AND type = 'TABLE';

        UPDATE core."view"
        SET name = 'All Doctors', icon = 'IconUserCheck'
        WHERE "objectMetadataId" = member_obj_id AND type = 'TABLE';

        -- 4. Clean & Reconfigure Navigation Menu Items for the Workspace
        DELETE FROM core."navigationMenuItem"
        WHERE "workspaceId" = ws_rec.id
          AND "folderId" IS NULL
          AND type = 'OBJECT';

        -- Pos 0: Patients
        INSERT INTO core."navigationMenuItem" (id, "universalIdentifier", "workspaceId", "applicationId", "targetObjectMetadataId", position, type, color, icon, name, "createdAt", "updatedAt")
        VALUES (gen_random_uuid(), gen_random_uuid(), ws_rec.id, app_id, person_obj_id, 0, 'OBJECT', 'sky', 'IconHeartbeat', 'Patients', NOW(), NOW());

        -- Pos 1: Appointments
        INSERT INTO core."navigationMenuItem" (id, "universalIdentifier", "workspaceId", "applicationId", "targetObjectMetadataId", position, type, color, icon, name, "createdAt", "updatedAt")
        VALUES (gen_random_uuid(), gen_random_uuid(), ws_rec.id, app_id, opp_obj_id, 1, 'OBJECT', 'blue', 'IconCalendarEvent', 'Appointments', NOW(), NOW());

        -- Pos 2: Doctors
        INSERT INTO core."navigationMenuItem" (id, "universalIdentifier", "workspaceId", "applicationId", "targetObjectMetadataId", position, type, color, icon, name, "createdAt", "updatedAt")
        VALUES (gen_random_uuid(), gen_random_uuid(), ws_rec.id, app_id, member_obj_id, 2, 'OBJECT', 'purple', 'IconUserCheck', 'Doctors', NOW(), NOW());

        -- Pos 3: Departments
        INSERT INTO core."navigationMenuItem" (id, "universalIdentifier", "workspaceId", "applicationId", "targetObjectMetadataId", position, type, color, icon, name, "createdAt", "updatedAt")
        VALUES (gen_random_uuid(), gen_random_uuid(), ws_rec.id, app_id, comp_obj_id, 3, 'OBJECT', 'turquoise', 'IconBuildingHospital', 'Departments', NOW(), NOW());

        -- Pos 4: Follow-ups
        INSERT INTO core."navigationMenuItem" (id, "universalIdentifier", "workspaceId", "applicationId", "targetObjectMetadataId", position, type, color, icon, name, "createdAt", "updatedAt")
        VALUES (gen_random_uuid(), gen_random_uuid(), ws_rec.id, app_id, task_obj_id, 4, 'OBJECT', 'orange', 'IconCalendarCheck', 'Follow-ups', NOW(), NOW());

        -- Pos 5: Reports
        INSERT INTO core."navigationMenuItem" (id, "universalIdentifier", "workspaceId", "applicationId", "targetObjectMetadataId", position, type, color, icon, name, "createdAt", "updatedAt")
        VALUES (gen_random_uuid(), gen_random_uuid(), ws_rec.id, app_id, dash_obj_id, 5, 'OBJECT', 'green', 'IconChartBar', 'Reports', NOW(), NOW());

        -- 5. Save Workspace Industry Configuration in keyValuePair
        DELETE FROM core."keyValuePair" WHERE "workspaceId" = ws_rec.id AND key = 'WORKSPACE_INDUSTRY_CONFIG';
        INSERT INTO core."keyValuePair" (id, "workspaceId", key, value, type, "createdAt", "updatedAt")
        VALUES (
            gen_random_uuid(),
            ws_rec.id,
            'WORKSPACE_INDUSTRY_CONFIG',
            '{"industry": "healthcare", "name": "Healthcare CRM", "modules": ["patients", "appointments", "doctors", "departments", "followUps", "reports"], "pipelines": ["patientAcquisition", "appointmentManagement"]}'::jsonb,
            'USER_VARIABLE',
            NOW(),
            NOW()
        );
    END LOOP;
    RAISE NOTICE 'Healthcare CRM workspace provisioning successfully completed.';
END $$;
