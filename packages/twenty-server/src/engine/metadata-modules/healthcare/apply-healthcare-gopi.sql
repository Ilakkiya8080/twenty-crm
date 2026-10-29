-- ============================================================================
-- HEALTHCARE CRM COMPLETE WORKSPACE PROVISIONING FOR ACTIVE WORKSPACE
-- ============================================================================
DO $$
DECLARE
    ws_id UUID := 'dd0bedb7-eaef-4f40-a7dc-7f5b619f8796';
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
    workflows_folder_id UUID;

    -- Doctor User IDs in core."user"
    u_doc1 UUID := '77777777-0001-4000-8000-000000000001';
    u_doc2 UUID := '77777777-0002-4000-8000-000000000002';
    u_doc3 UUID := '77777777-0003-4000-8000-000000000003';
    u_doc4 UUID := '77777777-0004-4000-8000-000000000004';
    u_doc5 UUID := '77777777-0005-4000-8000-000000000005';
    u_doc6 UUID := '77777777-0006-4000-8000-000000000006';

    -- Doctor IDs in workspaceMember
    doc1 UUID := '33333333-0001-4000-8000-000000000001';
    doc2 UUID := '33333333-0002-4000-8000-000000000002';
    doc3 UUID := '33333333-0003-4000-8000-000000000003';
    doc4 UUID := '33333333-0004-4000-8000-000000000004';
    doc5 UUID := '33333333-0005-4000-8000-000000000005';
    doc6 UUID := '33333333-0006-4000-8000-000000000006';

    -- Department IDs in company
    d1 UUID := '22222222-0001-4000-8000-000000000001';
    d2 UUID := '22222222-0002-4000-8000-000000000002';
    d3 UUID := '22222222-0003-4000-8000-000000000003';
    d4 UUID := '22222222-0004-4000-8000-000000000004';
    d5 UUID := '22222222-0005-4000-8000-000000000005';
    d6 UUID := '22222222-0006-4000-8000-000000000006';
    d7 UUID := '22222222-0007-4000-8000-000000000007';
    d8 UUID := '22222222-0008-4000-8000-000000000008';

    -- Patient IDs in person
    p1 UUID := '11111111-0001-4000-8000-000000000001';
    p2 UUID := '11111111-0002-4000-8000-000000000002';
    p3 UUID := '11111111-0003-4000-8000-000000000003';
    p4 UUID := '11111111-0004-4000-8000-000000000004';
    p5 UUID := '11111111-0005-4000-8000-000000000005';
    p6 UUID := '11111111-0006-4000-8000-000000000006';
    p7 UUID := '11111111-0007-4000-8000-000000000007';
    p8 UUID := '11111111-0008-4000-8000-000000000008';

    -- Appointment IDs in opportunity
    apt1 UUID := '44444444-0001-4000-8000-000000000001';
    apt2 UUID := '44444444-0002-4000-8000-000000000002';
    apt3 UUID := '44444444-0003-4000-8000-000000000003';
    apt4 UUID := '44444444-0004-4000-8000-000000000004';
    apt5 UUID := '44444444-0005-4000-8000-000000000005';
    apt6 UUID := '44444444-0006-4000-8000-000000000006';
    apt7 UUID := '44444444-0007-4000-8000-000000000007';
    apt8 UUID := '44444444-0008-4000-8000-000000000008';
    apt9 UUID := '44444444-0009-4000-8000-000000000009';
    apt10 UUID := '44444444-0010-4000-8000-000000000010';

    -- Follow-up IDs in task
    fu1 UUID := '55555555-0001-4000-8000-000000000001';
    fu2 UUID := '55555555-0002-4000-8000-000000000002';
    fu3 UUID := '55555555-0003-4000-8000-000000000003';
    fu4 UUID := '55555555-0004-4000-8000-000000000004';
    fu5 UUID := '55555555-0005-4000-8000-000000000005';
    fu6 UUID := '55555555-0006-4000-8000-000000000006';

    -- Report IDs in dashboard
    rep1 UUID := '66666666-0001-4000-8000-000000000001';
    rep2 UUID := '66666666-0002-4000-8000-000000000002';
    rep3 UUID := '66666666-0003-4000-8000-000000000003';
    rep4 UUID := '66666666-0004-4000-8000-000000000004';
BEGIN
    RAISE NOTICE 'Provisioning Pure Healthcare CRM for Workspace: %', ws_id;

    -- 0. Get Application ID
    SELECT id INTO app_id FROM core."application" WHERE "workspaceId" = ws_id LIMIT 1;

    -- 1. Update Core Object Metadata Labels and Icons to Healthcare Terminology
    UPDATE core."objectMetadata"
    SET "labelPlural" = 'Patients', "labelSingular" = 'Patient', icon = 'IconHeartbeat'
    WHERE "workspaceId" = ws_id AND "nameSingular" = 'person';

    UPDATE core."objectMetadata"
    SET "labelPlural" = 'Appointments', "labelSingular" = 'Appointment', icon = 'IconCalendarEvent'
    WHERE "workspaceId" = ws_id AND "nameSingular" = 'opportunity';

    UPDATE core."objectMetadata"
    SET "labelPlural" = 'Departments', "labelSingular" = 'Department', icon = 'IconBuildingHospital'
    WHERE "workspaceId" = ws_id AND "nameSingular" = 'company';

    UPDATE core."objectMetadata"
    SET "labelPlural" = 'Follow-ups', "labelSingular" = 'Follow-up', icon = 'IconCalendarCheck'
    WHERE "workspaceId" = ws_id AND "nameSingular" = 'task';

    UPDATE core."objectMetadata"
    SET "labelPlural" = 'Reports', "labelSingular" = 'Report', icon = 'IconChartBar'
    WHERE "workspaceId" = ws_id AND "nameSingular" = 'dashboard';

    UPDATE core."objectMetadata"
    SET "labelPlural" = 'Doctors', "labelSingular" = 'Doctor', icon = 'IconUserCheck'
    WHERE "workspaceId" = ws_id AND "nameSingular" = 'workspaceMember';

    -- Deactivate manufacturing and redundant custom objects
    UPDATE core."objectMetadata"
    SET "isActive" = false
    WHERE "workspaceId" = ws_id AND "nameSingular" IN (
        'product', 'productionOrder', 'rawMaterial', 'supplier', 'inventoryItem', 'qualityReport',
        'property listing','buyer & leads','site visit','deals','follow ups','reports'
        
    );

    -- Get Object IDs
    SELECT id INTO person_obj_id FROM core."objectMetadata" WHERE "workspaceId" = ws_id AND "nameSingular" = 'person';
    SELECT id INTO opp_obj_id FROM core."objectMetadata" WHERE "workspaceId" = ws_id AND "nameSingular" = 'opportunity';
    SELECT id INTO comp_obj_id FROM core."objectMetadata" WHERE "workspaceId" = ws_id AND "nameSingular" = 'company';
    SELECT id INTO task_obj_id FROM core."objectMetadata" WHERE "workspaceId" = ws_id AND "nameSingular" = 'task';
    SELECT id INTO dash_obj_id FROM core."objectMetadata" WHERE "workspaceId" = ws_id AND "nameSingular" = 'dashboard';
    SELECT id INTO member_obj_id FROM core."objectMetadata" WHERE "workspaceId" = ws_id AND "nameSingular" = 'workspaceMember';

    -- 2. Configure Appointment Stages (Clinical stages)
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

    -- 3. Configure Views
    UPDATE core."view"
    SET name = 'Appointment Management Pipeline',
        icon = 'IconCalendarEvent'
    WHERE "objectMetadataId" = opp_obj_id AND type = 'KANBAN';

    UPDATE core."view"
    SET icon = 'IconHeartbeat'
    WHERE "objectMetadataId" = person_obj_id AND key = 'INDEX';

    UPDATE core."view"
    SET icon = 'IconBuildingHospital'
    WHERE "objectMetadataId" = comp_obj_id;

    UPDATE core."view"
    SET icon = 'IconCalendarCheck'
    WHERE "objectMetadataId" = task_obj_id AND key = 'INDEX';

    UPDATE core."view"
    SET icon = 'IconChartBar'
    WHERE "objectMetadataId" = dash_obj_id;

    UPDATE core."view"
    SET icon = 'IconUserCheck'
    WHERE "objectMetadataId" = member_obj_id;

    -- 4. Get Workflows Folder ID if it exists
    SELECT id INTO workflows_folder_id FROM core."navigationMenuItem"
    WHERE "workspaceId" = ws_id AND type = 'FOLDER' LIMIT 1;

    -- 5. RECONFIGURE NAVIGATION MENU ITEMS - ONLY HEALTHCARE!
    -- Delete all non-folder menu items
    DELETE FROM core."navigationMenuItem"
    WHERE "workspaceId" = ws_id AND "folderId" IS NULL AND type = 'OBJECT';

    -- Pos 0: Patients
    INSERT INTO core."navigationMenuItem" (id, "universalIdentifier", "workspaceId", "applicationId", "targetObjectMetadataId", position, type, color, icon, "createdAt", "updatedAt")
    VALUES (gen_random_uuid(), gen_random_uuid(), ws_id, app_id, person_obj_id, 0, 'OBJECT', 'sky', 'IconHeartbeat', NOW(), NOW());

    -- Pos 1: Appointments
    INSERT INTO core."navigationMenuItem" (id, "universalIdentifier", "workspaceId", "applicationId", "targetObjectMetadataId", position, type, color, icon, "createdAt", "updatedAt")
    VALUES (gen_random_uuid(), gen_random_uuid(), ws_id, app_id, opp_obj_id, 1, 'OBJECT', 'blue', 'IconCalendarEvent', NOW(), NOW());

    -- Pos 2: Doctors
    INSERT INTO core."navigationMenuItem" (id, "universalIdentifier", "workspaceId", "applicationId", "targetObjectMetadataId", position, type, color, icon, "createdAt", "updatedAt")
    VALUES (gen_random_uuid(), gen_random_uuid(), ws_id, app_id, member_obj_id, 2, 'OBJECT', 'purple', 'IconUserCheck', NOW(), NOW());

    -- Pos 3: Departments
    INSERT INTO core."navigationMenuItem" (id, "universalIdentifier", "workspaceId", "applicationId", "targetObjectMetadataId", position, type, color, icon, "createdAt", "updatedAt")
    VALUES (gen_random_uuid(), gen_random_uuid(), ws_id, app_id, comp_obj_id, 3, 'OBJECT', 'turquoise', 'IconBuildingHospital', NOW(), NOW());

    -- Pos 4: Follow-ups
    INSERT INTO core."navigationMenuItem" (id, "universalIdentifier", "workspaceId", "applicationId", "targetObjectMetadataId", position, type, color, icon, "createdAt", "updatedAt")
    VALUES (gen_random_uuid(), gen_random_uuid(), ws_id, app_id, task_obj_id, 4, 'OBJECT', 'orange', 'IconCalendarCheck', NOW(), NOW());

    -- Pos 5: Reports
    INSERT INTO core."navigationMenuItem" (id, "universalIdentifier", "workspaceId", "applicationId", "targetObjectMetadataId", position, type, color, icon, "createdAt", "updatedAt")
    VALUES (gen_random_uuid(), gen_random_uuid(), ws_id, app_id, dash_obj_id, 5, 'OBJECT', 'green', 'IconChartBar', NOW(), NOW());

    -- Pos 6: Update Workflows Folder Position if present
    IF workflows_folder_id IS NOT NULL THEN
        UPDATE core."navigationMenuItem" SET position = 6 WHERE id = workflows_folder_id;
    END IF;

    -- 6. Clean Old SaaS Demo Data & Replace with Pure Healthcare Data
    DELETE FROM workspace_d343fta12decl7c79fe21qoie."timelineActivity";
    DELETE FROM workspace_d343fta12decl7c79fe21qoie."taskTarget";
    DELETE FROM workspace_d343fta12decl7c79fe21qoie.task;
    DELETE FROM workspace_d343fta12decl7c79fe21qoie.opportunity;
    DELETE FROM workspace_d343fta12decl7c79fe21qoie.person;
    DELETE FROM workspace_d343fta12decl7c79fe21qoie.company;
    DELETE FROM workspace_d343fta12decl7c79fe21qoie.dashboard;

    -- Ensure Doctor Users in core."user" and core."userWorkspace"
    DELETE FROM core."userWorkspace" WHERE "userId" IN (u_doc1, u_doc2, u_doc3, u_doc4, u_doc5, u_doc6);
    DELETE FROM core."user" WHERE email IN (
        'dr.vance@twentyhealth.org', 'dr.mitchell@twentyhealth.org', 'dr.brody@twentyhealth.org',
        'dr.lin@twentyhealth.org', 'dr.kim@twentyhealth.org', 'dr.evans@twentyhealth.org'
    ) OR id IN (u_doc1, u_doc2, u_doc3, u_doc4, u_doc5, u_doc6);

    INSERT INTO core."user" (id, "firstName", "lastName", email, "isEmailVerified", "createdAt", "updatedAt")
    VALUES
        (u_doc1, 'Alan', 'Vance', 'dr.vance@twentyhealth.org', true, NOW(), NOW()),
        (u_doc2, 'Sarah', 'Mitchell', 'dr.mitchell@twentyhealth.org', true, NOW(), NOW()),
        (u_doc3, 'Marcus', 'Brody', 'dr.brody@twentyhealth.org', true, NOW(), NOW()),
        (u_doc4, 'Olivia', 'Lin', 'dr.lin@twentyhealth.org', true, NOW(), NOW()),
        (u_doc5, 'David', 'Kim', 'dr.kim@twentyhealth.org', true, NOW(), NOW()),
        (u_doc6, 'Rachel', 'Evans', 'dr.evans@twentyhealth.org', true, NOW(), NOW());

    INSERT INTO core."userWorkspace" (id, "userId", "workspaceId", "createdAt", "updatedAt")
    VALUES
        (gen_random_uuid(), u_doc1, ws_id, NOW(), NOW()),
        (gen_random_uuid(), u_doc2, ws_id, NOW(), NOW()),
        (gen_random_uuid(), u_doc3, ws_id, NOW(), NOW()),
        (gen_random_uuid(), u_doc4, ws_id, NOW(), NOW()),
        (gen_random_uuid(), u_doc5, ws_id, NOW(), NOW()),
        (gen_random_uuid(), u_doc6, ws_id, NOW(), NOW());

    -- DOCTORS (workspaceMember)
    DELETE FROM workspace_d343fta12decl7c79fe21qoie."workspaceMember" WHERE id IN (doc1, doc2, doc3, doc4, doc5, doc6);
    INSERT INTO workspace_d343fta12decl7c79fe21qoie."workspaceMember" (
        id, "nameFirstName", "nameLastName", "jobTitle", "userEmail", "userId", position, "createdAt", "updatedAt"
    )
    VALUES
        (doc1, 'Alan', 'Vance', 'Chief Cardiologist • Available: Mon-Thu 08:00-16:00', 'dr.vance@twentyhealth.org', u_doc1, 1, NOW(), NOW()),
        (doc2, 'Sarah', 'Mitchell', 'Senior Orthopedic Surgeon • Available: Tue-Fri 09:00-17:00', 'dr.mitchell@twentyhealth.org', u_doc2, 2, NOW(), NOW()),
        (doc3, 'Marcus', 'Brody', 'Consultant Neurologist • Available: Mon-Wed 08:30-15:30', 'dr.brody@twentyhealth.org', u_doc3, 3, NOW(), NOW()),
        (doc4, 'Olivia', 'Lin', 'Lead Internist • Available: Mon-Fri 08:00-14:00', 'dr.lin@twentyhealth.org', u_doc4, 4, NOW(), NOW()),
        (doc5, 'David', 'Kim', 'Pediatric Specialist • Available: Wed-Sat 09:00-16:30', 'dr.kim@twentyhealth.org', u_doc5, 5, NOW(), NOW()),
        (doc6, 'Rachel', 'Evans', 'Diagnostic Radiologist • Available: Mon-Fri 09:00-17:00', 'dr.evans@twentyhealth.org', u_doc6, 6, NOW(), NOW());

    -- Update current admin user profile
    UPDATE workspace_d343fta12decl7c79fe21qoie."workspaceMember"
    SET "nameFirstName" = 'Chief Medical', "nameLastName" = 'Director', "jobTitle" = 'Medical Director & Administrator'
    WHERE "userEmail" = 'ilakkiya8080@gmail.com';

    UPDATE core."user"
    SET "firstName" = 'Chief Medical', "lastName" = 'Director'
    WHERE email = 'ilakkiya8080@gmail.com';

    -- DEPARTMENTS (company)
    INSERT INTO workspace_d343fta12decl7c79fe21qoie.company (
        id, name, "domainNamePrimaryLinkLabel", "domainNamePrimaryLinkUrl", "addressAddressStreet1", "addressAddressCity", "accountOwnerId", "createdAt", "updatedAt"
    )
    VALUES
        (d1, 'Cardiology Department', 'Dr. Alan Vance (Head)', 'https://twentyhealth.org/cardiology', 'Wing A, Floor 3', 'Central Medical Center', doc1, NOW(), NOW()),
        (d2, 'Neurology Department', 'Dr. Marcus Brody (Head)', 'https://twentyhealth.org/neurology', 'Wing B, Floor 2', 'Central Medical Center', doc3, NOW(), NOW()),
        (d3, 'Pediatrics Department', 'Dr. David Kim (Head)', 'https://twentyhealth.org/pediatrics', 'Children Center, Floor 1', 'Central Medical Center', doc5, NOW(), NOW()),
        (d4, 'Orthopedics & Sports Medicine', 'Dr. Sarah Mitchell (Head)', 'https://twentyhealth.org/orthopedics', 'Surgical Pavilion, Floor 4', 'Central Medical Center', doc2, NOW(), NOW()),
        (d5, 'Internal Medicine & Diagnostic Care', 'Dr. Olivia Lin (Head)', 'https://twentyhealth.org/internal-med', 'Outpatient Clinic, Floor 2', 'Central Medical Center', doc4, NOW(), NOW()),
        (d6, 'Radiology & Imaging Center', 'Dr. Rachel Evans (Head)', 'https://twentyhealth.org/radiology', 'Imaging Center, Basement 1', 'Central Medical Center', doc6, NOW(), NOW()),
        (d7, 'Oncology & Chemotherapy Unit', 'Cancer Care Pavilion', 'https://twentyhealth.org/oncology', 'Hope Wing, Floor 5', 'Central Medical Center', doc4, NOW(), NOW()),
        (d8, 'Emergency & Acute Care Service', 'Trauma Center Level 1', 'https://twentyhealth.org/emergency', 'Ground Floor Emergency Entry', 'Central Medical Center', doc1, NOW(), NOW());

    -- PATIENTS (person)
    INSERT INTO workspace_d343fta12decl7c79fe21qoie.person (
        id, "nameFirstName", "nameLastName", "emailsPrimaryEmail", "phonesPrimaryPhoneNumber", "jobTitle", "companyId", position, "createdAt", "updatedAt"
    )
    VALUES
        (p1, 'Sarah', 'Jenkins', 'sarah.jenkins@gmail.com', '+1 (555) 234-5678', 'PAT-1001 • Active Outpatient • DOB: 1988-04-12', d1, 0, NOW(), NOW()),
        (p2, 'Michael', 'Chang', 'm.chang@outlook.com', '+1 (555) 345-6789', 'PAT-1002 • Active Inpatient • DOB: 1975-09-23', d2, 1, NOW(), NOW()),
        (p3, 'Emily', 'Davis', 'emily.davis@yahoo.com', '+1 (555) 456-7890', 'PAT-1003 • Active Outpatient • DOB: 2018-11-05', d3, 2, NOW(), NOW()),
        (p4, 'Robert', 'Wilson', 'rwilson@icloud.com', '+1 (555) 567-8901', 'PAT-1004 • Post-Op Recovery • DOB: 1962-02-18', d4, 3, NOW(), NOW()),
        (p5, 'Amanda', 'Martinez', 'amanda.m@gmail.com', '+1 (555) 678-9012', 'PAT-1005 • Routine Follow-up • DOB: 1995-07-30', d5, 4, NOW(), NOW()),
        (p6, 'David', 'Cooper', 'david.cooper@gmail.com', '+1 (555) 789-0123', 'PAT-1006 • Cardiac Rehab • DOB: 1958-08-14', d1, 5, NOW(), NOW()),
        (p7, 'Jessica', 'Taylor', 'jessica.t@yahoo.com', '+1 (555) 890-1234', 'PAT-1007 • Pediatric Allergy • DOB: 2020-03-22', d3, 6, NOW(), NOW()),
        (p8, 'James', 'Anderson', 'james.anderson@work.com', '+1 (555) 901-2345', 'PAT-1008 • Orthopedic Consult • DOB: 1982-12-05', d4, 7, NOW(), NOW());

    -- APPOINTMENTS (opportunity)
    INSERT INTO workspace_d343fta12decl7c79fe21qoie.opportunity (
        id, name, "amountAmountMicros", "amountCurrencyCode", stage, "closeDate", "pointOfContactId", "companyId", "ownerId", position, "createdAt", "updatedAt"
    )
    VALUES
        (apt1, 'APPT-2026-01: Sarah Jenkins - Annual Cardiovascular Checkup', 250000000, 'USD', 'CONFIRMED', NOW() + INTERVAL '1 day', p1, d1, doc1, 0, NOW(), NOW()),
        (apt2, 'APPT-2026-02: Michael Chang - Migraine & Neurological Consult', 320000000, 'USD', 'CHECKED_IN', NOW() + INTERVAL '2 hours', p2, d2, doc3, 1, NOW(), NOW()),
        (apt3, 'APPT-2026-03: Emily Davis - Routine Pediatric Immunization', 150000000, 'USD', 'REQUESTED', NOW() + INTERVAL '2 days', p3, d3, doc5, 2, NOW(), NOW()),
        (apt4, 'APPT-2026-04: Robert Wilson - Post-Op Knee Arthroscopy Review', 200000000, 'USD', 'COMPLETED', NOW() - INTERVAL '1 day', p4, d4, doc2, 3, NOW(), NOW()),
        (apt5, 'APPT-2026-05: Amanda Martinez - Hypertension Assessment', 180000000, 'USD', 'COMPLETED', NOW() - INTERVAL '3 days', p5, d5, doc4, 4, NOW(), NOW()),
        (apt6, 'APPT-2026-06: Sarah Jenkins - Cardiac Stress Test Intake', 400000000, 'USD', 'NEW_INQUIRY', NOW() + INTERVAL '5 days', p1, d1, doc1, 5, NOW(), NOW()),
        (apt7, 'APPT-2026-07: David Cooper - Post-Infarction Follow-up', 300000000, 'USD', 'CONTACTED', NOW() + INTERVAL '3 days', p6, d1, doc1, 6, NOW(), NOW()),
        (apt8, 'APPT-2026-08: Jessica Taylor - Pediatric Asthma Evaluation', 220000000, 'USD', 'APPOINTMENT_BOOKED', NOW() + INTERVAL '4 days', p7, d3, doc5, 7, NOW(), NOW()),
        (apt9, 'APPT-2026-09: James Anderson - Shoulder MRI Review', 280000000, 'USD', 'CONVERTED', NOW() + INTERVAL '1 day', p8, d4, doc2, 8, NOW(), NOW()),
        (apt10, 'APPT-2026-10: Robert Wilson - Suture Removal Consultation', 120000000, 'USD', 'COMPLETED', NOW() - INTERVAL '4 days', p4, d4, doc2, 9, NOW(), NOW());

    -- CLINICAL FOLLOW-UPS (task)
    INSERT INTO workspace_d343fta12decl7c79fe21qoie.task (
        id, title, "bodyV2Markdown", status, "dueAt", "assigneeId", position, "createdAt", "updatedAt"
    )
    VALUES
        (fu1, 'FU-101: Robert Wilson - Knee Suture Removal & Range of Motion', 'Patient recovering from knee arthroscopy. Check incision healing, remove surgical sutures, assess knee flexion and refer to physiotherapy.', 'TODO', NOW() + INTERVAL '7 days', doc2, 0, NOW(), NOW()),
        (fu2, 'FU-102: Michael Chang - Review Brain MRI & Adjust Prophylaxis', 'Inspect high-resolution MRI scan results. Review headache frequency log and discuss initiation of beta-blocker migraine prophylaxis.', 'IN_PROGRESS', NOW() + INTERVAL '3 days', doc3, 1, NOW(), NOW()),
        (fu3, 'FU-103: Amanda Martinez - 14-Day Blood Pressure Log Audit', 'Patient logging daily morning and evening BP readings. If systolic remains > 135 mmHg, titrate Lisinopril from 10mg to 20mg daily.', 'TODO', NOW() + INTERVAL '14 days', doc4, 2, NOW(), NOW()),
        (fu4, 'FU-104: Sarah Jenkins - Post-consultation Fasting Lipid Panel', 'Check fasting lipid profile and glucose draw results prior to establishing long-term cardiovascular prevention regimen.', 'DONE', NOW() - INTERVAL '2 days', doc1, 3, NOW(), NOW()),
        (fu5, 'FU-105: David Cooper - Holter Monitor 48-Hour Return', 'Patient completed 48-hour continuous ECG telemetry monitoring. Return device to cardiology nurse station for rhythm strip extraction.', 'TODO', NOW() + INTERVAL '2 days', doc1, 4, NOW(), NOW()),
        (fu6, 'FU-106: Jessica Taylor - Pediatric Inhaler Technique Check', 'Follow up with patient mother to evaluate correct use of aerochamber spacer with budesonide inhaler twice daily.', 'IN_PROGRESS', NOW() + INTERVAL '5 days', doc5, 5, NOW(), NOW());

    -- TASK TARGETS
    INSERT INTO workspace_d343fta12decl7c79fe21qoie."taskTarget" (
        id, "taskId", "targetPersonId", "targetOpportunityId", "targetCompanyId", position, "createdAt", "updatedAt"
    )
    VALUES
        (gen_random_uuid(), fu1, p4, apt4, d4, 0, NOW(), NOW()),
        (gen_random_uuid(), fu2, p2, apt2, d2, 1, NOW(), NOW()),
        (gen_random_uuid(), fu3, p5, apt5, d5, 2, NOW(), NOW()),
        (gen_random_uuid(), fu4, p1, apt1, d1, 3, NOW(), NOW()),
        (gen_random_uuid(), fu5, p6, apt7, d1, 4, NOW(), NOW()),
        (gen_random_uuid(), fu6, p7, apt8, d3, 5, NOW(), NOW());

    -- CLINICAL REPORTS (dashboard)
    INSERT INTO workspace_d343fta12decl7c79fe21qoie.dashboard (
        id, title, position, "createdAt", "updatedAt"
    )
    VALUES
        (rep1, 'Monthly Patient Volume & Clinical Intake Analytics (142 Patients Active)', 0, NOW(), NOW()),
        (rep2, 'Appointment Status & Department Utilization Summary (87% Completion Rate)', 1, NOW(), NOW()),
        (rep3, 'Doctor Consultation Workload & Availability Metrics (Avg 18 Appts/Wk)', 2, NOW(), NOW()),
        (rep4, 'Clinical Follow-up Compliance & Patient Outreach Audit (92% Compliance)', 3, NOW(), NOW());

    -- 7. Update Workspace metadataVersion to invalidate frontend cache
    UPDATE core.workspace
    SET "metadataVersion" = "metadataVersion" + 1
    WHERE id = ws_id;

    RAISE NOTICE 'Pure Healthcare CRM Provisioning and Seeding Completed Successfully!';
END $$;
