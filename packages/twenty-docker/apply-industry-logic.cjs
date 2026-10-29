const { Client } = require('pg');

async function applyIndustry(industry, targetWorkspaceId) {
  const c = new Client({
    connectionString: process.env.PG_DATABASE_URL || 'postgres://twenty:twenty@db:5432/default',
  });
  await c.connect();

  console.log(`Applying pure industry template: "${industry}" for workspace: ${targetWorkspaceId || 'ALL'}`);

  const wsQuery = targetWorkspaceId
    ? `SELECT id, "databaseSchema" FROM core.workspace WHERE id = '${targetWorkspaceId}'`
    : `SELECT id, "databaseSchema" FROM core.workspace WHERE "deletedAt" IS NULL`;

  const wsList = await c.query(wsQuery);
  console.log(`wsList returned ${wsList.rows.length} rows:`, wsList.rows);

  for (const ws of wsList.rows) {
    const wsId = ws.id;
    const dbSchema = ws.databaseSchema;

    if (industry === 'healthcare') {
      console.log(`Configuring Pure Healthcare CRM for workspace: ${wsId}`);

      // 1. Update Core Object Metadata Labels and Icons to Pure Healthcare
      await c.query(`
        UPDATE core."objectMetadata"
        SET "labelPlural" = 'Patients', "labelSingular" = 'Patient', icon = 'IconHeartbeat', color = 'sky', "isActive" = true
        WHERE "workspaceId" = '${wsId}' AND "nameSingular" = 'person';

        UPDATE core."objectMetadata"
        SET "labelPlural" = 'Appointments', "labelSingular" = 'Appointment', icon = 'IconCalendarEvent', color = 'blue', "isActive" = true
        WHERE "workspaceId" = '${wsId}' AND "nameSingular" = 'opportunity';

        UPDATE core."objectMetadata"
        SET "labelPlural" = 'Departments', "labelSingular" = 'Department', icon = 'IconBuildingHospital', color = 'turquoise', "isActive" = true
        WHERE "workspaceId" = '${wsId}' AND "nameSingular" = 'company';

        UPDATE core."objectMetadata"
        SET "labelPlural" = 'Follow-ups', "labelSingular" = 'Follow-up', icon = 'IconCalendarCheck', color = 'orange', "isActive" = true
        WHERE "workspaceId" = '${wsId}' AND "nameSingular" = 'task';

        UPDATE core."objectMetadata"
        SET "labelPlural" = 'Reports', "labelSingular" = 'Report', icon = 'IconChartBar', color = 'green', "isActive" = true
        WHERE "workspaceId" = '${wsId}' AND "nameSingular" = 'dashboard';

        UPDATE core."objectMetadata"
        SET "labelPlural" = 'Doctors', "labelSingular" = 'Doctor', icon = 'IconUserCheck', color = 'purple', "isActive" = true
        WHERE "workspaceId" = '${wsId}' AND "nameSingular" = 'workspaceMember';

        UPDATE core."objectMetadata"
        SET "isActive" = false
        WHERE "workspaceId" = '${wsId}' AND "nameSingular" IN (
          'product', 'productionOrder', 'rawMaterial', 'supplier', 'inventoryItem', 'qualityReport',
          'patient', 'doctor', 'appointment', 'department', 'medicalRecord', 'note'
        );
      `);

      // Fetch Object IDs
      const metas = await c.query(`
        SELECT id, "nameSingular"
        FROM core."objectMetadata"
        WHERE "workspaceId" = $1;
      `, [wsId]);

      const metaMap = {};
      metas.rows.forEach(r => { metaMap[r.nameSingular] = r.id; });

      const personObjId = metaMap['person'];
      const oppObjId = metaMap['opportunity'];
      const compObjId = metaMap['company'];
      const taskObjId = metaMap['task'];
      const dashObjId = metaMap['dashboard'];
      const memberObjId = metaMap['workspaceMember'];

      // Fetch Application ID
      let appId = null;
      const appRes = await c.query(`SELECT id FROM core."application" WHERE "workspaceId" = $1 LIMIT 1`, [wsId]);
      if (appRes.rows.length > 0) {
        appId = appRes.rows[0].id;
      } else {
        const newApp = await c.query(`
          INSERT INTO core."application" (id, "workspaceId", "createdAt", "updatedAt")
          VALUES (gen_random_uuid(), $1, NOW(), NOW()) RETURNING id;
        `, [wsId]);
        appId = newApp.rows[0].id;
      }

      // 3. Add Clinical Stages to opportunity enum and fieldMetadata
      if (dbSchema) {
        const enumStages = [
          'REQUESTED', 'CONFIRMED', 'CHECKED_IN', 'COMPLETED', 'CANCELLED',
          'NO_SHOW', 'NEW_INQUIRY', 'CONTACTED', 'APPOINTMENT_BOOKED', 'CONVERTED', 'LOST'
        ];
        for (const stageVal of enumStages) {
          try {
            await c.query(`ALTER TYPE ${dbSchema}.opportunity_stage_enum ADD VALUE IF NOT EXISTS '${stageVal}'`);
          } catch (e) {
            // ignore if exists
          }
        }
      }

      if (oppObjId) {
        const oppStageField = await c.query(`
          SELECT id FROM core."fieldMetadata" WHERE "objectMetadataId" = $1 AND name = 'stage' LIMIT 1
        `, [oppObjId]);

        if (oppStageField.rows.length > 0) {
          await c.query(`
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
            WHERE id = $1;
          `, [oppStageField.rows[0].id]);
        }

        // Configure Views
        await c.query(`
          UPDATE core."view"
          SET name = 'Appointment Management Pipeline', icon = 'IconCalendarEvent'
          WHERE "objectMetadataId" = '${oppObjId}' AND type = 'KANBAN';

          UPDATE core."view"
          SET name = 'All Appointments', icon = 'IconCalendarEvent'
          WHERE "objectMetadataId" = '${oppObjId}' AND type = 'TABLE' AND key = 'INDEX';
        `);
      }

      if (personObjId) {
        await c.query(`
          UPDATE core."view"
          SET name = 'All Patients', icon = 'IconHeartbeat'
          WHERE "objectMetadataId" = $1 AND key = 'INDEX';
        `, [personObjId]);
      }
      if (compObjId) {
        await c.query(`
          UPDATE core."view"
          SET name = 'All Departments', icon = 'IconBuildingHospital'
          WHERE "objectMetadataId" = $1;
        `, [compObjId]);
      }
      if (taskObjId) {
        await c.query(`
          UPDATE core."view"
          SET name = 'All Follow-ups', icon = 'IconCalendarCheck'
          WHERE "objectMetadataId" = $1 AND key = 'INDEX';
        `, [taskObjId]);
      }
      if (dashObjId) {
        await c.query(`
          UPDATE core."view"
          SET name = 'Clinical Reports & Summaries', icon = 'IconChartBar'
          WHERE "objectMetadataId" = $1;
        `, [dashObjId]);
      }
      if (memberObjId) {
        await c.query(`
          UPDATE core."view"
          SET name = 'All Doctors', icon = 'IconUserCheck'
          WHERE "objectMetadataId" = $1;
        `, [memberObjId]);
      }

      // 4. CLEAN AND RECONFIGURE NAVIGATION MENU ITEMS - ONLY THE 6 HEALTHCARE MODULES!
      // Delete ALL navigation menu items for this workspace (no leftovers!)
      await c.query(`DELETE FROM core."navigationMenuItem" WHERE "workspaceId" = $1;`, [wsId]);

      // Exactly the 6 requested modules in order:
      // 0: Patients
      // 1: Appointments
      // 2: Doctors
      // 3: Departments
      // 4: Follow-ups
      // 5: Reports
      const healthcareNav = [
        { objId: personObjId, name: 'Patients', color: 'sky', icon: 'IconHeartbeat', pos: 0 },
        { objId: oppObjId, name: 'Appointments', color: 'blue', icon: 'IconCalendarEvent', pos: 1 },
        { objId: memberObjId, name: 'Doctors', color: 'purple', icon: 'IconUserCheck', pos: 2 },
        { objId: compObjId, name: 'Departments', color: 'turquoise', icon: 'IconBuildingHospital', pos: 3 },
        { objId: taskObjId, name: 'Follow-ups', color: 'orange', icon: 'IconCalendarCheck', pos: 4 },
        { objId: dashObjId, name: 'Reports', color: 'green', icon: 'IconChartBar', pos: 5 },
      ];

      for (const item of healthcareNav) {
        if (item.objId) {
          await c.query(`
            INSERT INTO core."navigationMenuItem" (
              id, "universalIdentifier", "workspaceId", "applicationId", "targetObjectMetadataId", position, type, color, icon, name, "createdAt", "updatedAt"
            ) VALUES (
              gen_random_uuid(), gen_random_uuid(), $1, $2, $3, $4, 'OBJECT', $5, $6, $7, NOW(), NOW()
            );
          `, [wsId, appId, item.objId, item.pos, item.color, item.icon, item.name]);
        }
      }

      // 5. Clean SaaS demo records and seed Healthcare records if dbSchema exists
      if (dbSchema) {
        try {
          await c.query(`
            DELETE FROM ${dbSchema}."timelineActivity";
            DELETE FROM ${dbSchema}."taskTarget";
            DELETE FROM ${dbSchema}.task;
            DELETE FROM ${dbSchema}.opportunity;
            DELETE FROM ${dbSchema}.person;
            DELETE FROM ${dbSchema}.company;
            DELETE FROM ${dbSchema}.dashboard;
          `);

          // Doctor users & members
          const doctors = [
            { uid: '77777777-0001-4000-8000-000000000001', docId: '33333333-0001-4000-8000-000000000001', fn: 'Alan', ln: 'Vance', email: 'dr.vance@twentyhealth.org', title: 'Chief Cardiologist - Available: Mon-Thu 08:00-16:00' },
            { uid: '77777777-0002-4000-8000-000000000002', docId: '33333333-0002-4000-8000-000000000002', fn: 'Sarah', ln: 'Mitchell', email: 'dr.mitchell@twentyhealth.org', title: 'Senior Orthopedic Surgeon - Available: Tue-Fri 09:00-17:00' },
            { uid: '77777777-0003-4000-8000-000000000003', docId: '33333333-0003-4000-8000-000000000003', fn: 'Marcus', ln: 'Brody', email: 'dr.brody@twentyhealth.org', title: 'Consultant Neurologist - Available: Mon-Wed 08:30-15:30' },
            { uid: '77777777-0004-4000-8000-000000000004', docId: '33333333-0004-4000-8000-000000000004', fn: 'Olivia', ln: 'Lin', email: 'dr.lin@twentyhealth.org', title: 'Lead Internist - Available: Mon-Fri 08:00-14:00' },
            { uid: '77777777-0005-4000-8000-000000000005', docId: '33333333-0005-4000-8000-000000000005', fn: 'David', ln: 'Kim', email: 'dr.kim@twentyhealth.org', title: 'Pediatric Specialist - Available: Wed-Sat 09:00-16:30' },
            { uid: '77777777-0006-4000-8000-000000000006', docId: '33333333-0006-4000-8000-000000000006', fn: 'Rachel', ln: 'Evans', email: 'dr.evans@twentyhealth.org', title: 'Diagnostic Radiologist - Available: Mon-Fri 09:00-17:00' },
          ];

          // Fetch admin role id for workspace
          const adminRoleRes = await c.query(`SELECT id FROM core.role WHERE "workspaceId" = $1 AND label = 'Admin' LIMIT 1`, [wsId]);
          const adminRoleId = adminRoleRes.rows[0]?.id;

          for (let i = 0; i < doctors.length; i++) {
            const d = doctors[i];
            await c.query(`DELETE FROM core."userWorkspace" WHERE "userId" = $1`, [d.uid]);
            await c.query(`DELETE FROM core."user" WHERE id = $1 OR email = $2`, [d.uid, d.email]);
            await c.query(`
              INSERT INTO core."user" (id, "firstName", "lastName", email, "isEmailVerified", "createdAt", "updatedAt")
              VALUES ($1, $2, $3, $4, true, NOW(), NOW())
            `, [d.uid, d.fn, d.ln, d.email]);

            const uwRes = await c.query(`
              INSERT INTO core."userWorkspace" (id, "userId", "workspaceId", "createdAt", "updatedAt")
              VALUES (gen_random_uuid(), $1, $2, NOW(), NOW()) RETURNING id;
            `, [d.uid, wsId]);
            const uwId = uwRes.rows[0].id;

            // Make first doctor co-admin so workspace user can delete account if desired
            if (i === 0 && adminRoleId) {
              await c.query(`
                INSERT INTO core."roleTarget" (id, "workspaceId", "roleId", "userWorkspaceId", "createdAt", "updatedAt", "universalIdentifier", "applicationId")
                VALUES (gen_random_uuid(), $1, $2, $3, NOW(), NOW(), gen_random_uuid(), $4)
              `, [wsId, adminRoleId, uwId, appId]);
            }

            await c.query(`DELETE FROM ${dbSchema}."workspaceMember" WHERE id = $1`, [d.docId]);
            await c.query(`
              INSERT INTO ${dbSchema}."workspaceMember" (id, "nameFirstName", "nameLastName", "jobTitle", "userEmail", "userId", position, "createdAt", "updatedAt")
              VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW())
            `, [d.docId, d.fn, d.ln, d.title, d.email, d.uid, i + 1]);
          }

          // Departments (company)
          const depts = [
            { id: '22222222-0001-4000-8000-000000000001', name: 'Cardiology Department', head: 'Dr. Alan Vance (Head)', wing: 'Wing A, Floor 3' },
            { id: '22222222-0002-4000-8000-000000000002', name: 'Neurology Department', head: 'Dr. Marcus Brody (Head)', wing: 'Wing B, Floor 2' },
            { id: '22222222-0003-4000-8000-000000000003', name: 'Pediatrics Department', head: 'Dr. David Kim (Head)', wing: 'Children Center, Floor 1' },
            { id: '22222222-0004-4000-8000-000000000004', name: 'Orthopedics & Sports Medicine', head: 'Dr. Sarah Mitchell (Head)', wing: 'Surgical Pavilion, Floor 4' },
            { id: '22222222-0005-4000-8000-000000000005', name: 'Internal Medicine & Diagnostic Care', head: 'Dr. Olivia Lin (Head)', wing: 'Outpatient Clinic, Floor 2' },
            { id: '22222222-0006-4000-8000-000000000006', name: 'Radiology & Imaging Center', head: 'Dr. Rachel Evans (Head)', wing: 'Imaging Center, Basement 1' },
            { id: '22222222-0007-4000-8000-000000000007', name: 'Oncology & Chemotherapy Unit', head: 'Cancer Care Pavilion', wing: 'Hope Wing, Floor 5' },
            { id: '22222222-0008-4000-8000-000000000008', name: 'Emergency & Acute Care Service', head: 'Trauma Center Level 1', wing: 'Ground Floor Emergency Entry' },
          ];

          for (const dept of depts) {
            await c.query(`
              INSERT INTO ${dbSchema}.company (id, name, "domainNamePrimaryLinkLabel", "addressAddressStreet1", "createdAt", "updatedAt")
              VALUES ($1, $2, $3, $4, NOW(), NOW())
            `, [dept.id, dept.name, dept.head, dept.wing]);
          }

          // Patients (person)
          const patients = [
            { id: '11111111-0001-4000-8000-000000000001', fn: 'Sarah', ln: 'Jenkins', email: 'sarah.jenkins@gmail.com', phone: '+1 (555) 234-5678', title: 'PAT-1001 - Active Outpatient - DOB: 1988-04-12', cid: depts[0].id },
            { id: '11111111-0002-4000-8000-000000000002', fn: 'Michael', ln: 'Chang', email: 'm.chang@outlook.com', phone: '+1 (555) 345-6789', title: 'PAT-1002 - Active Inpatient - DOB: 1975-09-23', cid: depts[1].id },
            { id: '11111111-0003-4000-8000-000000000003', fn: 'Emily', ln: 'Davis', email: 'emily.davis@yahoo.com', phone: '+1 (555) 456-7890', title: 'PAT-1003 - Active Outpatient - DOB: 2018-11-05', cid: depts[2].id },
            { id: '11111111-0004-4000-8000-000000000004', fn: 'Robert', ln: 'Wilson', email: 'rwilson@icloud.com', phone: '+1 (555) 567-8901', title: 'PAT-1004 - Post-Op Recovery - DOB: 1962-02-18', cid: depts[3].id },
            { id: '11111111-0005-4000-8000-000000000005', fn: 'Amanda', ln: 'Martinez', email: 'amanda.m@gmail.com', phone: '+1 (555) 678-9012', title: 'PAT-1005 - Routine Follow-up - DOB: 1995-07-30', cid: depts[4].id },
            { id: '11111111-0006-4000-8000-000000000006', fn: 'David', ln: 'Cooper', email: 'david.cooper@gmail.com', phone: '+1 (555) 789-0123', title: 'PAT-1006 - Cardiac Rehab - DOB: 1958-08-14', cid: depts[0].id },
            { id: '11111111-0007-4000-8000-000000000007', fn: 'Jessica', ln: 'Taylor', email: 'jessica.t@yahoo.com', phone: '+1 (555) 890-1234', title: 'PAT-1007 - Pediatric Allergy - DOB: 2020-03-22', cid: depts[2].id },
            { id: '11111111-0008-4000-8000-000000000008', fn: 'James', ln: 'Anderson', email: 'james.anderson@work.com', phone: '+1 (555) 901-2345', title: 'PAT-1008 - Orthopedic Consult - DOB: 1982-12-05', cid: depts[3].id },
          ];

          for (const p of patients) {
            await c.query(`
              INSERT INTO ${dbSchema}.person (id, "nameFirstName", "nameLastName", "emailsPrimaryEmail", "phonesPrimaryPhoneNumber", "jobTitle", "companyId", "createdAt", "updatedAt")
              VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW())
            `, [p.id, p.fn, p.ln, p.email, p.phone, p.title, p.cid]);
          }

          // Appointments (opportunity)
          const appts = [
            { id: '44444444-0001-4000-8000-000000000001', name: 'APPT-2026-01: Sarah Jenkins - Annual Cardiovascular Checkup', stage: 'CONFIRMED', pid: patients[0].id, cid: depts[0].id },
            { id: '44444444-0002-4000-8000-000000000002', name: 'APPT-2026-02: Michael Chang - Migraine & Neurological Consult', stage: 'CHECKED_IN', pid: patients[1].id, cid: depts[1].id },
            { id: '44444444-0003-4000-8000-000000000003', name: 'APPT-2026-03: Emily Davis - Routine Pediatric Immunization', stage: 'REQUESTED', pid: patients[2].id, cid: depts[2].id },
            { id: '44444444-0004-4000-8000-000000000004', name: 'APPT-2026-04: Robert Wilson - Post-Op Knee Arthroscopy Review', stage: 'COMPLETED', pid: patients[3].id, cid: depts[3].id },
            { id: '44444444-0005-4000-8000-000000000005', name: 'APPT-2026-05: Amanda Martinez - Hypertension Assessment', stage: 'COMPLETED', pid: patients[4].id, cid: depts[4].id },
            { id: '44444444-0006-4000-8000-000000000006', name: 'APPT-2026-06: Sarah Jenkins - Cardiac Stress Test Intake', stage: 'NEW_INQUIRY', pid: patients[0].id, cid: depts[0].id },
            { id: '44444444-0007-4000-8000-000000000007', name: 'APPT-2026-07: David Cooper - Post-Infarction Follow-up', stage: 'CONTACTED', pid: patients[5].id, cid: depts[0].id },
            { id: '44444444-0008-4000-8000-000000000008', name: 'APPT-2026-08: Jessica Taylor - Pediatric Asthma Evaluation', stage: 'APPOINTMENT_BOOKED', pid: patients[6].id, cid: depts[2].id },
            { id: '44444444-0009-4000-8000-000000000009', name: 'APPT-2026-09: James Anderson - Shoulder MRI Review', stage: 'CONVERTED', pid: patients[7].id, cid: depts[3].id },
            { id: '44444444-0010-4000-8000-000000000010', name: 'APPT-2026-10: Robert Wilson - Suture Removal Consultation', stage: 'COMPLETED', pid: patients[3].id, cid: depts[3].id },
          ];

          for (const a of appts) {
            await c.query(`
              INSERT INTO ${dbSchema}.opportunity (id, name, stage, "amountAmountMicros", "amountCurrencyCode", "pointOfContactId", "companyId", "closeDate", "createdAt", "updatedAt")
              VALUES ($1, $2, $3, 250000000, 'USD', $4, $5, NOW() + INTERVAL '1 day', NOW(), NOW())
            `, [a.id, a.name, a.stage, a.pid, a.cid]);
          }

          // Follow-ups (task)
          const followUps = [
            { id: '55555555-0001-4000-8000-000000000001', title: 'FU-101: Robert Wilson - Knee Suture Removal & Range of Motion', status: 'TODO', pid: patients[3].id, aid: appts[3].id, cid: depts[3].id },
            { id: '55555555-0002-4000-8000-000000000002', title: 'FU-102: Michael Chang - Review Brain MRI & Adjust Prophylaxis', status: 'IN_PROGRESS', pid: patients[1].id, aid: appts[1].id, cid: depts[1].id },
            { id: '55555555-0003-4000-8000-000000000003', title: 'FU-103: Amanda Martinez - 14-Day Blood Pressure Log Audit', status: 'TODO', pid: patients[4].id, aid: appts[4].id, cid: depts[4].id },
            { id: '55555555-0004-4000-8000-000000000004', title: 'FU-104: Sarah Jenkins - Post-consultation Fasting Lipid Panel', status: 'DONE', pid: patients[0].id, aid: appts[0].id, cid: depts[0].id },
            { id: '55555555-0005-4000-8000-000000000005', title: 'FU-105: David Cooper - Holter Monitor 48-Hour Return', status: 'TODO', pid: patients[5].id, aid: appts[6].id, cid: depts[0].id },
            { id: '55555555-0006-4000-8000-000000000006', title: 'FU-106: Jessica Taylor - Pediatric Inhaler Technique Check', status: 'IN_PROGRESS', pid: patients[6].id, aid: appts[7].id, cid: depts[2].id },
          ];

          for (const fu of followUps) {
            await c.query(`
              INSERT INTO ${dbSchema}.task (id, title, status, "dueAt", "createdAt", "updatedAt")
              VALUES ($1, $2, $3, NOW() + INTERVAL '7 days', NOW(), NOW())
            `, [fu.id, fu.title, fu.status]);

            await c.query(`
              INSERT INTO ${dbSchema}."taskTarget" (id, "taskId", "targetPersonId", "targetOpportunityId", "targetCompanyId", position, "createdAt", "updatedAt")
              VALUES (gen_random_uuid(), $1, $2, $3, $4, 0, NOW(), NOW())
            `, [fu.id, fu.pid, fu.aid, fu.cid]);
          }

          // Reports (dashboard)
          const reports = [
            { id: '66666666-0001-4000-8000-000000000001', title: 'Monthly Patient Volume & Clinical Intake Analytics (142 Patients Active)' },
            { id: '66666666-0002-4000-8000-000000000002', title: 'Appointment Status & Department Utilization Summary (87% Completion Rate)' },
            { id: '66666666-0003-4000-8000-000000000003', title: 'Doctor Consultation Workload & Availability Metrics (Avg 18 Appts/Wk)' },
            { id: '66666666-0004-4000-8000-000000000004', title: 'Clinical Follow-up Compliance & Patient Outreach Audit (92% Compliance)' },
          ];

          for (const rep of reports) {
            await c.query(`
              INSERT INTO ${dbSchema}.dashboard (id, title, position, "createdAt", "updatedAt")
              VALUES ($1, $2, 0, NOW(), NOW())
            `, [rep.id, rep.title]);
          }
        } catch (dataErr) {
          console.error(`Error populating healthcare data for schema ${dbSchema}:`, dataErr.message);
        }
      }
    } else if (industry === 'manufacturing') {
      console.log(`Configuring Pure Manufacturing CRM for workspace: ${wsId}`);

      // 1. Update Core Object Metadata Labels and Icons to Pure Manufacturing
      await c.query(`
        UPDATE core."objectMetadata"
        SET "labelPlural" = 'Products', "labelSingular" = 'Product', icon = 'IconPackage', color = 'blue', "isActive" = true
        WHERE "workspaceId" = '${wsId}' AND "nameSingular" = 'person';

        UPDATE core."objectMetadata"
        SET "labelPlural" = 'Production Orders', "labelSingular" = 'Production Order', icon = 'IconSettings', color = 'orange', "isActive" = true
        WHERE "workspaceId" = '${wsId}' AND "nameSingular" = 'opportunity';

        UPDATE core."objectMetadata"
        SET "labelPlural" = 'Raw Materials', "labelSingular" = 'Raw Material', icon = 'IconCube', color = 'purple', "isActive" = true
        WHERE "workspaceId" = '${wsId}' AND "nameSingular" = 'task';

        UPDATE core."objectMetadata"
        SET "labelPlural" = 'Suppliers', "labelSingular" = 'Supplier', icon = 'IconTruck', color = 'turquoise', "isActive" = true
        WHERE "workspaceId" = '${wsId}' AND "nameSingular" = 'company';

        UPDATE core."objectMetadata"
        SET "labelPlural" = 'Inventory', "labelSingular" = 'Inventory Item', icon = 'IconBuildingWarehouse', color = 'sky', "isActive" = true
        WHERE "workspaceId" = '${wsId}' AND "nameSingular" = 'note';

        UPDATE core."objectMetadata"
        SET "labelPlural" = 'Quality Control', "labelSingular" = 'Quality Report', icon = 'IconChecklist', color = 'green', "isActive" = true
        WHERE "workspaceId" = '${wsId}' AND "nameSingular" = 'dashboard';

        UPDATE core."objectMetadata"
        SET "labelPlural" = 'Team Members', "labelSingular" = 'Team Member', icon = 'IconUserCheck', color = 'purple', "isActive" = true
        WHERE "workspaceId" = '${wsId}' AND "nameSingular" = 'workspaceMember';

        UPDATE core."objectMetadata"
        SET "isActive" = false
        WHERE "workspaceId" = '${wsId}' AND "nameSingular" IN (
          'product', 'productionOrder', 'rawMaterial', 'supplier', 'inventoryItem', 'qualityReport',
          'patient', 'doctor', 'appointment', 'department', 'medicalRecord', 'workflow'
        );
      `);

      // 2. Fetch Object IDs and Application ID
      const metas = await c.query(`
        SELECT id, "nameSingular"
        FROM core."objectMetadata"
        WHERE "workspaceId" = $1;
      `, [wsId]);

      const metaMap = {};
      metas.rows.forEach(r => { metaMap[r.nameSingular] = r.id; });

      const personObjId = metaMap['person'];
      const oppObjId = metaMap['opportunity'];
      const compObjId = metaMap['company'];
      const taskObjId = metaMap['task'];
      const noteObjId = metaMap['note'];
      const dashObjId = metaMap['dashboard'];

      let appId = null;
      const appRes = await c.query(`SELECT id FROM core."application" WHERE "workspaceId" = $1 LIMIT 1`, [wsId]);
      if (appRes.rows.length > 0) {
        appId = appRes.rows[0].id;
      } else {
        const newApp = await c.query(`
          INSERT INTO core."application" (id, "workspaceId", "createdAt", "updatedAt")
          VALUES (gen_random_uuid(), $1, NOW(), NOW()) RETURNING id;
        `, [wsId]);
        appId = newApp.rows[0].id;
      }

      // 3. Add Manufacturing Stages to opportunity_stage_enum and fieldMetadata
      if (dbSchema) {
        const enumStages = [
          'NEW_ORDER', 'PLANNING', 'IN_PRODUCTION', 'QUALITY_CHECK', 'COMPLETED', 'CANCELLED',
          'REQUESTED', 'CONFIRMED', 'CHECKED_IN', 'NO_SHOW', 'NEW_INQUIRY', 'CONTACTED', 'APPOINTMENT_BOOKED', 'CONVERTED', 'LOST'
        ];
        for (const stageVal of enumStages) {
          try {
            await c.query(`ALTER TYPE ${dbSchema}.opportunity_stage_enum ADD VALUE IF NOT EXISTS '${stageVal}'`);
          } catch (e) {
            // ignore if exists
          }
        }
      }

      if (oppObjId) {
        const oppStageField = await c.query(`
          SELECT id FROM core."fieldMetadata" WHERE "objectMetadataId" = $1 AND name = 'stage' LIMIT 1
        `, [oppObjId]);

        if (oppStageField.rows.length > 0) {
          await c.query(`
            UPDATE core."fieldMetadata"
            SET options = '[
              {"id": "20202020-0001-5afd-9c39-d2063097587a", "color": "sky", "label": "New Order", "value": "NEW_ORDER", "position": 0},
              {"id": "20202020-0002-5671-ac32-26d304dacb6e", "color": "purple", "label": "Planning", "value": "PLANNING", "position": 1},
              {"id": "20202020-0003-5acc-b5ca-f6531a8ecb4a", "color": "yellow", "label": "In Production", "value": "IN_PRODUCTION", "position": 2},
              {"id": "20202020-0004-5f6b-91bc-f413e9b2f654", "color": "turquoise", "label": "Quality Check", "value": "QUALITY_CHECK", "position": 3},
              {"id": "20202020-0005-5a6f-a8b2-774bbad21104", "color": "green", "label": "Completed", "value": "COMPLETED", "position": 4},
              {"id": "20202020-0006-5a6f-a8b2-774bbad21105", "color": "red", "label": "Cancelled", "value": "CANCELLED", "position": 5}
            ]'::jsonb
            WHERE id = $1;
          `, [oppStageField.rows[0].id]);
        }

        // Configure Views for Production Orders
        await c.query(`
          UPDATE core."view"
          SET name = 'Production Workflow Pipeline', icon = 'IconSettings'
          WHERE "objectMetadataId" = '${oppObjId}' AND type = 'KANBAN';

          UPDATE core."view"
          SET name = 'All Production Orders', icon = 'IconSettings'
          WHERE "objectMetadataId" = '${oppObjId}' AND type = 'TABLE' AND key = 'INDEX';
        `);

        const kanbanViewRes = await c.query(`
          SELECT id FROM core."view" WHERE "objectMetadataId" = $1 AND type = 'KANBAN' LIMIT 1
        `, [oppObjId]);
        if (kanbanViewRes.rows.length > 0) {
          const kanbanViewId = kanbanViewRes.rows[0].id;
          await c.query(`DELETE FROM core."viewGroup" WHERE "viewId" = $1`, [kanbanViewId]);
          const mfgStages = ['NEW_ORDER', 'PLANNING', 'IN_PRODUCTION', 'QUALITY_CHECK', 'COMPLETED', 'CANCELLED'];
          for (let sIdx = 0; sIdx < mfgStages.length; sIdx++) {
            await c.query(`
              INSERT INTO core."viewGroup" (id, "universalIdentifier", "viewId", "fieldValue", "isVisible", position, "workspaceId", "applicationId", "createdAt", "updatedAt")
              VALUES (gen_random_uuid(), gen_random_uuid(), $1, $2, true, $3, $4, $5, NOW(), NOW())
            `, [kanbanViewId, mfgStages[sIdx], sIdx, wsId, appId]);
          }
        }
      }

      if (personObjId) {
        await c.query(`
          UPDATE core."view"
          SET name = 'All Products', icon = 'IconPackage'
          WHERE "objectMetadataId" = $1 AND key = 'INDEX';
        `, [personObjId]);
      }

      if (compObjId) {
        await c.query(`
          UPDATE core."view"
          SET name = 'All Suppliers', icon = 'IconTruck'
          WHERE "objectMetadataId" = $1;
        `, [compObjId]);
      }

      if (taskObjId) {
        await c.query(`
          UPDATE core."view"
          SET name = 'All Raw Materials', icon = 'IconCube'
          WHERE "objectMetadataId" = $1;
        `, [taskObjId]);
      }

      if (noteObjId) {
        await c.query(`
          UPDATE core."view"
          SET name = 'All Inventory Items', icon = 'IconBuildingWarehouse', key = 'INDEX'
          WHERE "objectMetadataId" = $1 AND type = 'TABLE';
        `, [noteObjId]);
      }

      if (dashObjId) {
        await c.query(`
          UPDATE core."view"
          SET name = 'Quality Control Reports & Metrics', icon = 'IconChecklist'
          WHERE "objectMetadataId" = $1;
        `, [dashObjId]);
      }

      // 4. CLEAN AND RECONFIGURE NAVIGATION MENU ITEMS - EXACTLY THE 6 MANUFACTURING MODULES!
      await c.query(`DELETE FROM core."navigationMenuItem" WHERE "workspaceId" = $1;`, [wsId]);

      // In order requested:
      // 0: Products (person)
      // 1: Production Orders (opportunity)
      // 2: Raw Materials (task)
      // 3: Suppliers (company)
      // 4: Inventory (note)
      // 5: Quality Control (dashboard)
      const mfgNav = [
        { objId: personObjId, name: 'Products', color: 'blue', icon: 'IconPackage', pos: 0 },
        { objId: oppObjId, name: 'Production Orders', color: 'orange', icon: 'IconSettings', pos: 1 },
        { objId: taskObjId, name: 'Raw Materials', color: 'purple', icon: 'IconCube', pos: 2 },
        { objId: compObjId, name: 'Suppliers', color: 'turquoise', icon: 'IconTruck', pos: 3 },
        { objId: noteObjId, name: 'Inventory', color: 'sky', icon: 'IconBuildingWarehouse', pos: 4 },
        { objId: dashObjId, name: 'Quality Control', color: 'green', icon: 'IconChecklist', pos: 5 },
      ];

      for (const item of mfgNav) {
        if (item.objId && appId) {
          await c.query(`
            INSERT INTO core."navigationMenuItem" (
              id, "universalIdentifier", "workspaceId", "applicationId", "targetObjectMetadataId", position, type, color, icon, name, "createdAt", "updatedAt"
            ) VALUES (
              gen_random_uuid(), gen_random_uuid(), $1, $2, $3, $4, 'OBJECT', $5, $6, $7, NOW(), NOW()
            );
          `, [wsId, appId, item.objId, item.pos, item.color, item.icon, item.name]);
        }
      }

      // 5. Clean SaaS demo records (Airbnb, Anthropic, Stripe, Figma, Notion) and seed Manufacturing records
      if (dbSchema) {
        try {
          await c.query(`
            DELETE FROM ${dbSchema}."timelineActivity";
            DELETE FROM ${dbSchema}."taskTarget";
            DELETE FROM ${dbSchema}.task;
            DELETE FROM ${dbSchema}.opportunity;
            DELETE FROM ${dbSchema}.person;
            DELETE FROM ${dbSchema}.company;
            DELETE FROM ${dbSchema}.note;
            DELETE FROM ${dbSchema}.dashboard;
          `);

          // A. Suppliers (company table) - 8 Authentic Suppliers
          const suppliers = [
            { id: '22222222-0001-5000-8000-000000000001', name: 'Apex Precision Alloys & Metals', contact: 'Marcus Sterling (VP Supply Chain)', domain: 'apexalloys.com', street: '104 Industrial Parkway, Building 4', city: 'Detroit, MI' },
            { id: '22222222-0002-5000-8000-000000000002', name: 'Global Chemical & Polymer Corp', contact: 'Elena Rostova (Head of Procurement)', domain: 'globalchemical.com', street: 'Pier 9, Logistics Harbor Terminal', city: 'Houston, TX' },
            { id: '22222222-0003-5000-8000-000000000003', name: 'MicroTech Semiconductor Solutions', contact: 'Takeshi Tanaka (Senior Director)', domain: 'microtech-ic.com', street: '502 Tech Blvd, Silicon Corridor', city: 'San Jose, CA' },
            { id: '22222222-0004-5000-8000-000000000004', name: 'Fastener & Heavy Hardware Dynamics', contact: 'Carlos Morales (Industrial Sales Mgr)', domain: 'fastenerdynamics.com', street: '77 Hardware Blvd, Zone 3', city: 'Chicago, IL' },
            { id: '22222222-0005-5000-8000-000000000005', name: 'HydraFlow Actuation Systems', contact: 'Liam Gallagher (VP Fluid Power)', domain: 'hydraflow.co.uk', street: '12 Aeropark Drive, Hangar 6', city: 'Seattle, WA' },
            { id: '22222222-0006-5000-8000-000000000006', name: 'EcoPackaging & Industrial Crating', contact: 'Brigitte Meyer (Logistics Director)', domain: 'ecopackaging.com', street: 'Logistics Terminal B, Bay 7', city: 'Atlanta, GA' },
            { id: '22222222-0007-5000-8000-000000000007', name: 'OmniSensors Industrial Automation', contact: 'Henrik Lindqvist (Chief Engineer)', domain: 'omnisensors.com', street: '340 Robotics Way, Suite 100', city: 'Boston, MA' },
            { id: '22222222-0008-5000-8000-000000000008', name: 'Vanguard Composite Materials', contact: 'Dr. Sandra Patel (Materials Science Lead)', domain: 'vanguardcomposites.com', street: '88 Carbon Road, Advanced Tech Park', city: 'Austin, TX' },
          ];

          for (let i = 0; i < suppliers.length; i++) {
            const s = suppliers[i];
            await c.query(`
              INSERT INTO ${dbSchema}.company (
                id, name, "domainNamePrimaryLinkLabel", "domainNamePrimaryLinkUrl", "linkedinLinkPrimaryLinkLabel", "linkedinLinkPrimaryLinkUrl", "addressAddressStreet1", "addressAddressCity",
                position, "createdByName", "updatedByName", "createdBySource", "updatedBySource", "createdAt", "updatedAt"
              ) VALUES (
                $1, $2, $3, $4, $5, 'https://linkedin.com', $6, $7,
                $8, 'System', 'System', 'MANUAL', 'MANUAL', NOW(), NOW()
              );
            `, [s.id, s.name, s.domain, s.domain, s.contact, s.street, s.city, i]);
          }

          // B. Products (person table) - 8 Products
          const products = [
            { id: '11111111-0001-5000-8000-000000000001', fn: 'Industrial AC', ln: 'Servo Motor V4', email: 'SKU-7001', phone: '$1,250.00 / unit', title: 'Propulsion & Motion • Unit: pcs • Cost: $420 • Status: Active', cid: suppliers[0].id },
            { id: '11111111-0002-5000-8000-000000000002', fn: 'Microprocessor Control', ln: 'Board X10', email: 'SKU-7002', phone: '$220.00 / unit', title: 'Sensors & Control • Unit: pcs • Cost: $65 • Status: Active', cid: suppliers[2].id },
            { id: '11111111-0003-5000-8000-000000000003', fn: 'Heavy-Duty Hydraulic', ln: 'Actuator 5000', email: 'SKU-7003', phone: '$780.00 / unit', title: 'Automation & Fluid • Unit: pcs • Cost: $260 • Status: Active', cid: suppliers[4].id },
            { id: '11111111-0004-5000-8000-000000000004', fn: 'Modular Lithium Power', ln: 'Pack 48V', email: 'SKU-7004', phone: '$2,650.00 / unit', title: 'Energy & Storage • Unit: pcs • Cost: $890 • Status: Active', cid: suppliers[1].id },
            { id: '11111111-0005-5000-8000-000000000005', fn: 'CNC Milled Aluminum', ln: 'Chassis 200', email: 'SKU-7005', phone: '$340.00 / unit', title: 'Structural Frames • Unit: pcs • Cost: $110 • Status: Active', cid: suppliers[3].id },
            { id: '11111111-0006-5000-8000-000000000006', fn: 'High-Efficiency Gas', ln: 'Turbine Impeller', email: 'SKU-7006', phone: '$4,850.00 / unit', title: 'Turbomachinery • Unit: pcs • Cost: $1,450 • Status: Active', cid: suppliers[0].id },
            { id: '11111111-0007-5000-8000-000000000007', fn: 'Multi-Axis MEMS', ln: 'Vibration Sensor', email: 'SKU-7007', phone: '$175.00 / unit', title: 'IoT Diagnostics • Unit: pcs • Cost: $45 • Status: Active', cid: suppliers[6].id },
            { id: '11111111-0008-5000-8000-000000000008', fn: 'Aerospace Carbon Fiber', ln: 'Fairing Ring', email: 'SKU-7008', phone: '$3,200.00 / unit', title: 'Composite Shells • Unit: pcs • Cost: $980 • Status: Active', cid: suppliers[7].id },
          ];

          for (let i = 0; i < products.length; i++) {
            const p = products[i];
            await c.query(`
              INSERT INTO ${dbSchema}.person (
                id, "nameFirstName", "nameLastName", "emailsPrimaryEmail", "phonesPrimaryPhoneNumber", "jobTitle", "companyId",
                position, "createdByName", "updatedByName", "createdBySource", "updatedBySource", "createdAt", "updatedAt"
              ) VALUES (
                $1, $2, $3, $4, $5, $6, $7,
                $8, 'System', 'System', 'MANUAL', 'MANUAL', NOW(), NOW()
              );
            `, [p.id, p.fn, p.ln, p.email, p.phone, p.title, p.cid, i]);
          }

          // C. Production Orders (opportunity table) - 8 Orders
          const productionOrders = [
            { id: '44444444-0001-5000-8000-000000000001', name: 'PO-8001: 500x Industrial Servo Motor V4 Assembly', stage: 'IN_PRODUCTION', amount: 45000000000, pid: products[0].id, cid: suppliers[0].id, days: 5 },
            { id: '44444444-0002-5000-8000-000000000002', name: 'PO-8002: 1200x Microprocessor Board SMT Batch', stage: 'QUALITY_CHECK', amount: 24000000000, pid: products[1].id, cid: suppliers[2].id, days: 2 },
            { id: '44444444-0003-5000-8000-000000000003', name: 'PO-8003: 150x Hydraulic Actuator Machining Run', stage: 'PLANNING', amount: 32000000000, pid: products[2].id, cid: suppliers[4].id, days: 12 },
            { id: '44444444-0004-5000-8000-000000000004', name: 'PO-8004: 300x Lithium Power Module Pack Assembly', stage: 'COMPLETED', amount: 58000000000, pid: products[3].id, cid: suppliers[1].id, days: -1 },
            { id: '44444444-0005-5000-8000-000000000005', name: 'PO-8005: 800x CNC Milled Chassis Stamping', stage: 'NEW_ORDER', amount: 16000000000, pid: products[4].id, cid: suppliers[3].id, days: 18 },
            { id: '44444444-0006-5000-8000-000000000006', name: 'PO-8006: 50x Turbine Impeller Aerodynamic Profiling', stage: 'IN_PRODUCTION', amount: 62500000000, pid: products[5].id, cid: suppliers[0].id, days: 7 },
            { id: '44444444-0007-5000-8000-000000000007', name: 'PO-8007: 2500x Vibration Sensor Calibration Lot', stage: 'PLANNING', amount: 28500000000, pid: products[6].id, cid: suppliers[6].id, days: 14 },
            { id: '44444444-0008-5000-8000-000000000008', name: 'PO-8008: 75x Carbon Fiber Fairing Ring Autoclave Cure', stage: 'QUALITY_CHECK', amount: 72000000000, pid: products[7].id, cid: suppliers[7].id, days: 3 },
          ];

          for (let i = 0; i < productionOrders.length; i++) {
            const po = productionOrders[i];
            await c.query(`
              INSERT INTO ${dbSchema}.opportunity (
                id, name, stage, "amountAmountMicros", "amountCurrencyCode", "pointOfContactId", "companyId", "closeDate",
                position, "createdByName", "updatedByName", "createdBySource", "updatedBySource", "createdAt", "updatedAt"
              ) VALUES (
                $1, $2, $3, $4, 'USD', $5, $6, NOW() + ($7 || ' days')::interval,
                $8, 'System', 'System', 'MANUAL', 'MANUAL', NOW(), NOW()
              );
            `, [po.id, po.name, po.stage, po.amount, po.pid, po.cid, po.days, i]);
          }

          // D. Raw Materials (task table) - 8 Materials
          const rawMaterials = [
            { id: '55555555-0001-5000-8000-000000000001', title: 'MAT-9001: Grade 6061-T6 Aluminum Billets - Avail: 2,450 kg - Reorder: 500 kg - Cost: $85.50/kg', body: '2.5 Metric Tons of 6061-T6 extruded aluminum required for Chassis milling. Lot certified mill test reports attached in Bay A-12.', status: 'IN_PROGRESS', days: 4, oid: productionOrders[4].id, cid: suppliers[3].id },
            { id: '55555555-0002-5000-8000-000000000002', title: 'MAT-9002: High-Purity Silicon Wafers 200mm - Avail: 500 units - Reorder: 200 units - Cost: $42.00/unit', body: '500 prime semiconductor wafers scheduled for robotic cleanroom pick-and-place run. Cleanroom level 100 protocol.', status: 'TODO', days: 7, oid: productionOrders[1].id, cid: suppliers[2].id },
            { id: '55555555-0003-5000-8000-000000000003', title: 'MAT-9003: Copper Magnet Wire 18 AWG - Avail: 40 spools - Reorder: 10 spools - Cost: $19.50/spool', body: '40 spools copper magnet wire delivered and verified at incoming goods dock. Resistivity test passed.', status: 'DONE', days: -2, oid: productionOrders[0].id, cid: suppliers[0].id },
            { id: '55555555-0004-5000-8000-000000000004', title: 'MAT-9004: Neodymium Rare-Earth Magnets N52 - Avail: 1,000 pcs - Reorder: 250 pcs - Cost: $28.75/pc', body: '1,000 N52 high-flux permanent magnets inspected on dock 3. Flux density measurement nominal.', status: 'IN_PROGRESS', days: 3, oid: productionOrders[0].id, cid: suppliers[3].id },
            { id: '55555555-0005-5000-8000-000000000005', title: 'MAT-9005: Aerospace Grade 5 Titanium Bar (50mm) - Avail: 480 kg - Reorder: 150 kg - Cost: $115.00/kg', body: 'Grade 5 AMS 4928 aerospace titanium bars. Certified tensile strength 950 MPa. Storage Bay A-12.', status: 'IN_PROGRESS', days: 6, oid: productionOrders[5].id, cid: suppliers[0].id },
            { id: '55555555-0006-5000-8000-000000000006', title: 'MAT-9006: Hydraulic Valve Spool Castings - Avail: 620 pcs - Reorder: 120 pcs - Cost: $54.00/pc', body: 'Ductile iron valve spool castings ready for precision CNC honing. Tolerance 0.002mm.', status: 'TODO', days: 9, oid: productionOrders[2].id, cid: suppliers[4].id },
            { id: '55555555-0007-5000-8000-000000000007', title: 'MAT-9007: Automotive Lithium NMC Cathode Powder - Avail: 1,800 kg - Reorder: 400 kg - Cost: $38.00/kg', body: '1,800 kg battery-grade NMC 811 cathode powder. Dry room vault storage with dew point < -45°C.', status: 'DONE', days: -1, oid: productionOrders[3].id, cid: suppliers[1].id },
            { id: '55555555-0008-5000-8000-000000000008', title: 'MAT-9008: Aerospace Toray T800 Carbon Prepreg - Avail: 350 m² - Reorder: 80 m² - Cost: $145.00/m²', body: '350 m² unidirectional carbon epoxy prepreg tape stored in Freezer Bay F-02 (-18°C). Out-time tracked.', status: 'IN_PROGRESS', days: 5, oid: productionOrders[7].id, cid: suppliers[7].id },
          ];

          for (let i = 0; i < rawMaterials.length; i++) {
            const rm = rawMaterials[i];
            await c.query(`
              INSERT INTO ${dbSchema}.task (
                id, title, "bodyV2Markdown", status, "dueAt",
                position, "createdByName", "updatedByName", "createdBySource", "updatedBySource", "createdAt", "updatedAt"
              ) VALUES (
                $1, $2, $3, $4, NOW() + ($5 || ' days')::interval,
                $6, 'System', 'System', 'MANUAL', 'MANUAL', NOW(), NOW()
              );
            `, [rm.id, rm.title, rm.body, rm.status, rm.days, i]);

            await c.query(`
              INSERT INTO ${dbSchema}."taskTarget" (id, "taskId", "targetOpportunityId", "targetCompanyId", position, "createdAt", "updatedAt")
              VALUES (gen_random_uuid(), $1, $2, $3, 0, NOW(), NOW());
            `, [rm.id, rm.oid, rm.cid]);
          }

          // E. Inventory (note table) - 8 Inventory Lots
          const inventory = [
            { id: '77777777-0001-5000-8000-000000000001', title: 'INV-101: Warehouse Bay A-12 - Finished Servo Motors (SKU-7001)', body: 'Stock: 450 units boxed, barcode scanned, palletized and shrink-wrapped. Quality release tag #QR-994 attached. Ready for shipping dock allocation. Status: In Stock.' },
            { id: '77777777-0002-5000-8000-000000000002', title: 'INV-102: Cold Room B - Silicon Wafers Cassettes (SKU-7002)', body: 'Stock: 350 sealed nitrogen-flushed cassettes at 21°C controlled temperature and 40% RH humidity. Lot tracked under wafer fab #WF-2026-X. Status: Optimal.' },
            { id: '77777777-0003-5000-8000-000000000003', title: 'INV-103: Raw Material Yard C - Structural Aluminum Billets (MAT-9001)', body: 'Stock: 12 metric tons stacked and weather-covered. Certified tensile strength 310 MPa. Allocated across Orders 8003 and 8005. Status: In Stock.' },
            { id: '77777777-0004-5000-8000-000000000004', title: 'INV-104: High-Value Vault B - Microprocessor IC Units (MAT-9002)', body: 'Stock: 2,400 IC units logged into ERP. Anti-static moisture barrier bags intact with humidity indicator cards at < 10%. Status: Optimal.' },
            { id: '77777777-0005-5000-8000-000000000005', title: 'INV-105: Warehouse Bay B-08 - Hydraulic Actuators (SKU-7003)', body: 'Stock: 180 units ready for dispatch. Tested at 5,000 PSI with hydraulic fluid flushed. Status: In Stock.' },
            { id: '77777777-0006-5000-8000-000000000006', title: 'INV-106: Packaging Staging Area - Lithium Power Packs (SKU-7004)', body: 'Stock: 320 units UN 3480 certified packaging for dangerous goods transport. Status: Ready for Dispatch.' },
            { id: '77777777-0007-5000-8000-000000000007', title: 'INV-107: Cleanroom Staging Area - MEMS Vibration Sensors (SKU-7007)', body: 'Stock: 1,500 units pre-calibrated and tape-and-reel packaged. Lot inspection cert #QC-7007 attached. Status: In Stock.' },
            { id: '77777777-0008-5000-8000-000000000008', title: 'INV-108: Freezer Vault F-02 - Carbon Fiber Prepreg Rolls (MAT-9008)', body: 'Stock: 42 rolls at -18°C. Remaining out-time budget: 184 hours. Monitored by continuous IoT dataloggers. Status: Controlled Storage.' },
          ];

          for (let i = 0; i < inventory.length; i++) {
            const inv = inventory[i];
            await c.query(`
              INSERT INTO ${dbSchema}.note (
                id, title, "bodyV2Markdown",
                position, "createdByName", "updatedByName", "createdBySource", "updatedBySource", "createdAt", "updatedAt"
              ) VALUES (
                $1, $2, $3,
                $4, 'System', 'System', 'MANUAL', 'MANUAL', NOW(), NOW()
              );
            `, [inv.id, inv.title, inv.body, i]);
          }

          // F. Quality Control (dashboard table) - 8 QC Reports
          const qualityReports = [
            { id: '66666666-0001-5000-8000-000000000001', title: 'QC-2026-01: First-Pass Yield (FPY) & Assembly Line Defect Analytics (98.4% Compliance) - Result: PASSED - Defects: 0 - Inspector: Devon Ross' },
            { id: '66666666-0002-5000-8000-000000000002', title: 'QC-2026-02: Incoming Raw Material Inspection & Supplier Non-Conformance Report (99.1% Pass) - Result: PASSED - Defects: 0 - Inspector: Kavita Nair' },
            { id: '66666666-0003-5000-8000-000000000003', title: 'QC-2026-03: Overall Equipment Effectiveness (OEE) & Machine Uptime Metrics (89.2% Availability) - Status: OPTIMAL' },
            { id: '66666666-0004-5000-8000-000000000004', title: 'QC-2026-04: Servo Actuator 350-Bar High Pressure Hydraulic Leak Test - Result: ZERO DEFECTS - Inspector: Devon Ross' },
            { id: '66666666-0005-5000-8000-000000000005', title: 'QC-2026-05: Aerospace Titanium Ultrasonic Non-Destructive Flaw Detection - Result: 100% CERTIFIED - Inspector: Liam Gallagher' },
            { id: '66666666-0006-5000-8000-000000000006', title: 'QC-2026-06: Microprocessor High-Temperature Burn-In Stress Test (125°C) - Result: PASSED - Inspector: Kavita Nair' },
            { id: '66666666-0007-5000-8000-000000000007', title: 'QC-2026-07: Lithium Battery Pack Thermal Dissipation & Cyclic Charge-Discharge Audit - Result: CERTIFIED - Inspector: Devon Ross' },
            { id: '66666666-0008-5000-8000-000000000008', title: 'QC-2026-08: Carbon Fiber Autoclave Void Ratio Ultrasonic Scan (0.12% Voids < 1% Spec) - Result: APPROVED - Inspector: Dr. Sandra Patel' },
          ];

          for (let i = 0; i < qualityReports.length; i++) {
            const qr = qualityReports[i];
            await c.query(`
              INSERT INTO ${dbSchema}.dashboard (
                id, title,
                position, "createdByName", "updatedByName", "createdBySource", "updatedBySource", "createdAt", "updatedAt"
              ) VALUES (
                $1, $2,
                $3, 'System', 'System', 'MANUAL', 'MANUAL', NOW(), NOW()
              );
            `, [qr.id, qr.title, i]);
          }

          console.log(`Successfully purged SaaS demo data and seeded Pure Manufacturing records into ${dbSchema}!`);
        } catch (mfgErr) {
          console.error(`Error populating manufacturing data for schema ${dbSchema}:`, mfgErr.message);
        }
      }
    } else if (industry === 'realestate') {
      console.log(`Configuring Pure Real Estate CRM for workspace: ${wsId}`);

      // 1. Update Core Object Metadata Labels and Icons to Pure Real Estate
      await c.query(`
        UPDATE core."objectMetadata"
        SET "labelPlural" = 'Property Listings', "labelSingular" = 'Property Listing', icon = 'IconBuildingSkyscraper', color = 'turquoise', "isActive" = true
        WHERE "workspaceId" = '${wsId}' AND "nameSingular" = 'company';

        UPDATE core."objectMetadata"
        SET "labelPlural" = 'Buyers & Leads', "labelSingular" = 'Buyer & Lead', icon = 'IconUserCheck', color = 'blue', "isActive" = true
        WHERE "workspaceId" = '${wsId}' AND "nameSingular" = 'person';

        UPDATE core."objectMetadata"
        SET "labelPlural" = 'Site Visits', "labelSingular" = 'Site Visit', icon = 'IconCalendarEvent', color = 'sky', "isActive" = true
        WHERE "workspaceId" = '${wsId}' AND "nameSingular" = 'note';

        UPDATE core."objectMetadata"
        SET "labelPlural" = 'Deals', "labelSingular" = 'Deal', icon = 'IconCurrencyDollar', color = 'green', "isActive" = true
        WHERE "workspaceId" = '${wsId}' AND "nameSingular" = 'opportunity';

        UPDATE core."objectMetadata"
        SET "labelPlural" = 'Follow-ups', "labelSingular" = 'Follow-up', icon = 'IconPhoneCall', color = 'orange', "isActive" = true
        WHERE "workspaceId" = '${wsId}' AND "nameSingular" = 'task';

        UPDATE core."objectMetadata"
        SET "labelPlural" = 'Reports', "labelSingular" = 'Report', icon = 'IconChartPie', color = 'purple', "isActive" = true
        WHERE "workspaceId" = '${wsId}' AND "nameSingular" = 'dashboard';

        UPDATE core."objectMetadata"
        SET "labelPlural" = 'Agents & Brokers', "labelSingular" = 'Agent', icon = 'IconUserCheck', color = 'purple', "isActive" = true
        WHERE "workspaceId" = '${wsId}' AND "nameSingular" = 'workspaceMember';

        UPDATE core."objectMetadata"
        SET "isActive" = false
        WHERE "workspaceId" = '${wsId}' AND "nameSingular" IN (
          'product', 'productionOrder', 'rawMaterial', 'supplier', 'inventoryItem', 'qualityReport',
          'patient', 'doctor', 'appointment', 'department', 'medicalRecord', 'workflow'
        );
      `);

      // 2. Fetch Object IDs and Application ID
      const metas = await c.query(`
        SELECT id, "nameSingular"
        FROM core."objectMetadata"
        WHERE "workspaceId" = $1;
      `, [wsId]);

      const metaMap = {};
      metas.rows.forEach(r => { metaMap[r.nameSingular] = r.id; });

      const compObjId = metaMap['company']; // Property Listings
      const personObjId = metaMap['person']; // Buyers & Leads
      const noteObjId = metaMap['note']; // Site Visits
      const oppObjId = metaMap['opportunity']; // Deals
      const taskObjId = metaMap['task']; // Follow-ups
      const dashObjId = metaMap['dashboard']; // Reports

      let appId = null;
      const appRes = await c.query(`SELECT id FROM core."application" WHERE "workspaceId" = $1 LIMIT 1`, [wsId]);
      if (appRes.rows.length > 0) {
        appId = appRes.rows[0].id;
      } else {
        const newApp = await c.query(`
          INSERT INTO core."application" (id, "workspaceId", "createdAt", "updatedAt")
          VALUES (gen_random_uuid(), $1, NOW(), NOW()) RETURNING id;
        `, [wsId]);
        appId = newApp.rows[0].id;
      }

      // 3. Add Real Estate Deal Stages to opportunity_stage_enum and fieldMetadata
      if (dbSchema) {
        const enumStages = [
          'NEW_DEAL', 'NEGOTIATION', 'DOCUMENTATION', 'CLOSED_WON', 'CLOSED_LOST',
          'NEW_LEAD', 'QUALIFIED', 'SITE_VISIT', 'CONVERTED', 'LOST'
        ];
        for (const stageVal of enumStages) {
          try {
            await c.query(`ALTER TYPE ${dbSchema}.opportunity_stage_enum ADD VALUE IF NOT EXISTS '${stageVal}'`);
          } catch (e) {
            // ignore if exists
          }
        }
      }

      if (oppObjId) {
        const oppStageField = await c.query(`
          SELECT id FROM core."fieldMetadata" WHERE "objectMetadataId" = $1 AND name = 'stage' LIMIT 1
        `, [oppObjId]);

        if (oppStageField.rows.length > 0) {
          await c.query(`
            UPDATE core."fieldMetadata"
            SET options = '[
              {"id": "50505050-0001-4afd-9c39-d2063097587a", "color": "sky", "label": "New Deal", "value": "NEW_DEAL", "position": 0},
              {"id": "50505050-0002-4671-ac32-26d304dacb6e", "color": "yellow", "label": "Negotiation", "value": "NEGOTIATION", "position": 1},
              {"id": "50505050-0003-4acc-b5ca-f6531a8ecb4a", "color": "purple", "label": "Documentation", "value": "DOCUMENTATION", "position": 2},
              {"id": "50505050-0004-4f6b-91bc-f413e9b2f654", "color": "green", "label": "Closed Won", "value": "CLOSED_WON", "position": 3},
              {"id": "50505050-0005-4a6f-a8b2-774bbad21104", "color": "red", "label": "Closed Lost", "value": "CLOSED_LOST", "position": 4}
            ]'::jsonb
            WHERE id = $1;
          `, [oppStageField.rows[0].id]);
        }

        // Configure Views for Deals
        await c.query(`
          UPDATE core."view"
          SET name = 'Deal Pipeline', icon = 'IconCurrencyDollar'
          WHERE "objectMetadataId" = '${oppObjId}' AND type = 'KANBAN';

          UPDATE core."view"
          SET name = 'All Deals', icon = 'IconCurrencyDollar'
          WHERE "objectMetadataId" = '${oppObjId}' AND type = 'TABLE' AND key = 'INDEX';
        `);

        const kanbanViewRes = await c.query(`
          SELECT id FROM core."view" WHERE "objectMetadataId" = $1 AND type = 'KANBAN' LIMIT 1
        `, [oppObjId]);
        if (kanbanViewRes.rows.length > 0) {
          const kanbanViewId = kanbanViewRes.rows[0].id;
          await c.query(`DELETE FROM core."viewGroup" WHERE "viewId" = $1`, [kanbanViewId]);
          const realEstateStages = ['NEW_DEAL', 'NEGOTIATION', 'DOCUMENTATION', 'CLOSED_WON', 'CLOSED_LOST'];
          for (let sIdx = 0; sIdx < realEstateStages.length; sIdx++) {
            await c.query(`
              INSERT INTO core."viewGroup" (id, "universalIdentifier", "viewId", "fieldValue", "isVisible", position, "workspaceId", "applicationId", "createdAt", "updatedAt")
              VALUES (gen_random_uuid(), gen_random_uuid(), $1, $2, true, $3, $4, $5, NOW(), NOW())
            `, [kanbanViewId, realEstateStages[sIdx], sIdx, wsId, appId]);
          }
        }

        // Configure Lead Pipeline View
        let leadViewRes = await c.query(`
          SELECT id FROM core."view" WHERE "objectMetadataId" = $1 AND name = 'Lead Pipeline' LIMIT 1
        `, [oppObjId]);
        let leadViewId;
        if (leadViewRes.rows.length === 0) {
          const newLeadV = await c.query(`
            INSERT INTO core."view" (id, "universalIdentifier", name, type, "objectMetadataId", "workspaceId", "applicationId", position, icon, "createdAt", "updatedAt")
            VALUES (gen_random_uuid(), gen_random_uuid(), 'Lead Pipeline', 'KANBAN', $1, $2, $3, 1, 'IconUserCheck', NOW(), NOW())
            RETURNING id;
          `, [oppObjId, wsId, appId]);
          leadViewId = newLeadV.rows[0].id;
        } else {
          leadViewId = leadViewRes.rows[0].id;
        }

        await c.query(`DELETE FROM core."viewGroup" WHERE "viewId" = $1`, [leadViewId]);
        const leadPipelineStages = ['NEW_LEAD', 'QUALIFIED', 'SITE_VISIT', 'NEGOTIATION', 'CONVERTED', 'LOST'];
        for (let lIdx = 0; lIdx < leadPipelineStages.length; lIdx++) {
          await c.query(`
            INSERT INTO core."viewGroup" (id, "universalIdentifier", "viewId", "fieldValue", "isVisible", position, "workspaceId", "applicationId", "createdAt", "updatedAt")
            VALUES (gen_random_uuid(), gen_random_uuid(), $1, $2, true, $3, $4, $5, NOW(), NOW())
          `, [leadViewId, leadPipelineStages[lIdx], lIdx, wsId, appId]);
        }
      }

      if (compObjId) {
        await c.query(`
          UPDATE core."view"
          SET name = 'All Property Listings', icon = 'IconBuildingSkyscraper'
          WHERE "objectMetadataId" = $1 AND key = 'INDEX';
        `, [compObjId]);
      }

      if (personObjId) {
        await c.query(`
          UPDATE core."view"
          SET name = 'All Buyers & Leads', icon = 'IconUserCheck'
          WHERE "objectMetadataId" = $1 AND key = 'INDEX';
        `, [personObjId]);
      }

      if (noteObjId) {
        await c.query(`
          UPDATE core."view"
          SET name = 'All Site Visits', icon = 'IconCalendarEvent'
          WHERE "objectMetadataId" = $1 AND key = 'INDEX';
        `, [noteObjId]);
      }

      if (taskObjId) {
        await c.query(`
          UPDATE core."view"
          SET name = 'All Follow-ups', icon = 'IconPhoneCall'
          WHERE "objectMetadataId" = $1;
        `, [taskObjId]);
      }

      if (dashObjId) {
        await c.query(`
          UPDATE core."view"
          SET name = 'Real Estate Reports & Analytics', icon = 'IconChartPie'
          WHERE "objectMetadataId" = $1;
        `, [dashObjId]);
      }

      // 4. CLEAN AND RECONFIGURE NAVIGATION MENU ITEMS - EXACTLY THE 6 REAL ESTATE MODULES!
      await c.query(`DELETE FROM core."navigationMenuItem" WHERE "workspaceId" = $1;`, [wsId]);

      // In order requested by user:
      // 0: Property Listings (company)
      // 1: Buyers & Leads (person)
      // 2: Site Visits (note)
      // 3: Deals (opportunity)
      // 4: Follow-ups (task)
      // 5: Reports (dashboard)
      const realEstateNav = [
        { objId: compObjId, name: 'Property Listings', color: 'turquoise', icon: 'IconBuildingSkyscraper', pos: 0 },
        { objId: personObjId, name: 'Buyers & Leads', color: 'blue', icon: 'IconUserCheck', pos: 1 },
        { objId: noteObjId, name: 'Site Visits', color: 'sky', icon: 'IconCalendarEvent', pos: 2 },
        { objId: oppObjId, name: 'Deals', color: 'green', icon: 'IconCurrencyDollar', pos: 3 },
        { objId: taskObjId, name: 'Follow-ups', color: 'orange', icon: 'IconPhoneCall', pos: 4 },
        { objId: dashObjId, name: 'Reports', color: 'purple', icon: 'IconChartPie', pos: 5 },
      ];

      for (const item of realEstateNav) {
        if (item.objId && appId) {
          await c.query(`
            INSERT INTO core."navigationMenuItem" (
              id, "universalIdentifier", "workspaceId", "applicationId", "targetObjectMetadataId", position, type, color, icon, name, "createdAt", "updatedAt"
            ) VALUES (
              gen_random_uuid(), gen_random_uuid(), $1, $2, $3, $4, 'OBJECT', $5, $6, $7, NOW(), NOW()
            );
          `, [wsId, appId, item.objId, item.pos, item.color, item.icon, item.name]);
        }
      }

      // 5. Clean SaaS demo records and seed authentic Real Estate records
      if (dbSchema) {
        try {
          await c.query(`
            DELETE FROM ${dbSchema}."timelineActivity";
            DELETE FROM ${dbSchema}."taskTarget";
            DELETE FROM ${dbSchema}.task;
            DELETE FROM ${dbSchema}.opportunity;
            DELETE FROM ${dbSchema}.person;
            DELETE FROM ${dbSchema}.company;
            DELETE FROM ${dbSchema}.note;
            DELETE FROM ${dbSchema}.dashboard;
          `);

          // A. Property Listings (company table) - 8 Properties
          const properties = [
            {
              id: '33333333-0001-4000-8000-000000000001',
              name: 'Skyline Grand Penthouse',
              street: '742 Evergreen Terrace, Floor 42',
              city: 'San Francisco, CA',
              tag: 'Villa/Penthouse • For Sale • Available',
              url: 'https://realestate-crm.internal/listings/skyline-penthouse',
              details: '$2,450,000 • 4 Bed / 5 Bath • 4,800 Sq.ft',
            },
            {
              id: '33333333-0002-4000-8000-000000000002',
              name: 'Emerald Valley Luxury Villa 4B',
              street: '18 Orchard Crest Way',
              city: 'Austin, TX',
              tag: 'Villa • For Sale • Available',
              url: 'https://realestate-crm.internal/listings/emerald-valley-4b',
              details: '$1,650,000 • 5 Bed / 4 Bath • 3,950 Sq.ft',
            },
            {
              id: '33333333-0003-4000-8000-000000000003',
              name: 'Grand Horizon Residences Apt 1204',
              street: '88 Ocean Avenue, Suite 1204',
              city: 'Miami, FL',
              tag: 'Apartment • For Rent ($4,800/mo) • Reserved',
              url: 'https://realestate-crm.internal/listings/grand-horizon-1204',
              details: '$4,800 / mo • 2 Bed / 2 Bath • 1,350 Sq.ft',
            },
            {
              id: '33333333-0004-4000-8000-000000000004',
              name: 'Oasis Commercial Plaza Suite 300',
              street: '400 Financial District Blvd, Suite 300',
              city: 'New York, NY',
              tag: 'Commercial • For Rent ($9,200/mo) • Available',
              url: 'https://realestate-crm.internal/listings/oasis-plaza-300',
              details: '$9,200 / mo • Commercial Lease • 3,200 Sq.ft',
            },
            {
              id: '33333333-0005-4000-8000-000000000005',
              name: 'Sunset Bay Waterfront Villa',
              street: '12 Marina Boulevard',
              city: 'San Diego, CA',
              tag: 'Waterfront Villa • For Sale • Sold',
              url: 'https://realestate-crm.internal/listings/sunset-bay-villa',
              details: '$3,200,000 • 6 Bed / 6 Bath • 5,600 Sq.ft',
            },
            {
              id: '33333333-0006-4000-8000-000000000006',
              name: 'Harmony Heights 3BHK Residence',
              street: '55 Pinecrest Lane, Apt 8B',
              city: 'Seattle, WA',
              tag: 'Apartment • For Sale • Available',
              url: 'https://realestate-crm.internal/listings/harmony-heights-3bhk',
              details: '$780,000 • 3 Bed / 3 Bath • 1,850 Sq.ft',
            },
            {
              id: '33333333-0007-4000-8000-000000000007',
              name: 'Silicon Square Tech Hub Unit 10',
              street: '1020 Innovation Drive, Unit 10',
              city: 'San Jose, CA',
              tag: 'Commercial • For Sale • Under Contract',
              url: 'https://realestate-crm.internal/listings/silicon-square-10',
              details: '$1,850,000 • Commercial Tech Hub • 4,100 Sq.ft',
            },
            {
              id: '33333333-0008-4000-8000-000000000008',
              name: 'Greenfield Premium Villa Plot 18',
              street: 'Sector 8 Eco Valley, Plot 18',
              city: 'Denver, CO',
              tag: 'Plot • For Sale • Available',
              url: 'https://realestate-crm.internal/listings/greenfield-plot-18',
              details: '$450,000 • Residential Plot • 10,000 Sq.ft',
            },
          ];

          for (let i = 0; i < properties.length; i++) {
            const p = properties[i];
            await c.query(`
              INSERT INTO ${dbSchema}.company (
                id, name, "domainNamePrimaryLinkLabel", "domainNamePrimaryLinkUrl", "linkedinLinkPrimaryLinkLabel", "linkedinLinkPrimaryLinkUrl", "addressAddressStreet1", "addressAddressCity",
                position, "createdByName", "updatedByName", "createdBySource", "updatedBySource", "createdAt", "updatedAt"
              ) VALUES (
                $1, $2, $3, $4, $5, 'https://linkedin.com', $6, $7,
                $8, 'System', 'System', 'MANUAL', 'MANUAL', NOW(), NOW()
              );
            `, [p.id, p.name, p.tag, p.url, p.details, p.street, p.city, i]);
          }

          // B. Buyers & Leads (person table) - 8 Leads
          const leads = [
            {
              id: '44444444-0001-4000-8000-000000000001',
              first: 'Alexander',
              last: 'Wright',
              email: 'alexander.wright@luxurybuyer.com',
              phone: '+1 (415) 890-1234',
              req: 'Buyer: Luxury Penthouse ($2.4M) • Source: Ads • Pre-approved',
              city: 'San Francisco, CA',
              propId: '33333333-0001-4000-8000-000000000001',
            },
            {
              id: '44444444-0002-4000-8000-000000000002',
              first: 'Sophia',
              last: 'Martinez',
              email: 'sophia.m@fintechcorp.io',
              phone: '+1 (512) 674-8891',
              req: 'Buyer: Luxury Villa ($1.6M) • Source: Website • Financing Ready',
              city: 'Austin, TX',
              propId: '33333333-0002-4000-8000-000000000002',
            },
            {
              id: '44444444-0003-4000-8000-000000000003',
              first: 'Devin',
              last: 'Chen',
              email: 'devin.chen@chenholdings.com',
              phone: '+1 (212) 555-0199',
              req: 'Tenant: Commercial Plaza ($10K/mo) • Source: Referral • Corporate Lease',
              city: 'New York, NY',
              propId: '33333333-0004-4000-8000-000000000004',
            },
            {
              id: '44444444-0004-4000-8000-000000000004',
              first: 'Priya',
              last: 'Sharma',
              email: 'priya.sharma@medresearch.org',
              phone: '+1 (305) 781-4432',
              req: 'Tenant: Luxury Apt ($5K/mo) • Source: Walk-in • Relocating',
              city: 'Miami, FL',
              propId: '33333333-0003-4000-8000-000000000003',
            },
            {
              id: '44444444-0005-4000-8000-000000000005',
              first: 'Michael',
              last: "O'Connor",
              email: 'm.oconnor@investments.com',
              phone: '+1 (619) 402-9981',
              req: 'Buyer: Waterfront Villa ($3.2M) • Source: Website • Cash Buyer',
              city: 'San Diego, CA',
              propId: '33333333-0005-4000-8000-000000000005',
            },
            {
              id: '44444444-0006-4000-8000-000000000006',
              first: 'Rachel',
              last: 'Green',
              email: 'rachel.green@fashionexec.com',
              phone: '+1 (206) 912-7743',
              req: 'Buyer: 3BHK Residence ($780K) • Source: Ads • First-time Buyer',
              city: 'Seattle, WA',
              propId: '33333333-0006-4000-8000-000000000006',
            },
            {
              id: '44444444-0007-4000-8000-000000000007',
              first: 'Vikram',
              last: 'Patel',
              email: 'vikram.patel@greentech.com',
              phone: '+1 (408) 332-1109',
              req: 'Buyer: Commercial Hub ($1.8M) • Source: Referral • Tech Expansion',
              city: 'San Jose, CA',
              propId: '33333333-0007-4000-8000-000000000007',
            },
            {
              id: '44444444-0008-4000-8000-000000000008',
              first: 'Emma',
              last: 'Watson',
              email: 'emma.watson@designstudio.net',
              phone: '+1 (303) 844-6621',
              req: 'Buyer: Eco Villa Plot ($450K) • Source: Website • Immediate Build',
              city: 'Denver, CO',
              propId: '33333333-0008-4000-8000-000000000008',
            },
          ];

          for (let i = 0; i < leads.length; i++) {
            const l = leads[i];
            await c.query(`
              INSERT INTO ${dbSchema}.person (
                id, "nameFirstName", "nameLastName", "emailsPrimaryEmail", "phonesPrimaryPhoneNumber", "jobTitle", "companyId",
                position, "createdByName", "updatedByName", "createdBySource", "updatedBySource", "createdAt", "updatedAt"
              ) VALUES (
                $1, $2, $3, $4, $5, $6, $7,
                $8, 'System', 'System', 'MANUAL', 'MANUAL', NOW(), NOW()
              );
            `, [l.id, l.first, l.last, l.email, l.phone, `${l.req} • Location: ${l.city}`, l.propId, i]);
          }

          // C. Site Visits (note table) - 8 Site Visits
          const visits = [
            {
              id: '55555555-0001-4000-8000-000000000001',
              title: 'Site Visit: Alexander Wright @ Skyline Grand Penthouse',
              body: 'Visit Details:\n• Buyer: Alexander Wright (Pre-approved up to $3M)\n• Property: Skyline Grand Penthouse (Floor 42, 4,800 Sq.ft)\n• Date & Time: Oct 30, 2026 at 10:30 AM\n• Status: Scheduled\n• Assigned Agent: Marcus Vance\n• Feedback & Agenda: Private sunset terrace tour and private elevator key inspection.\n• Next Action Date: Nov 01, 2026 (Draft formal purchase agreement)',
            },
            {
              id: '55555555-0002-4000-8000-000000000002',
              title: 'Site Visit: Sophia Martinez @ Emerald Valley Luxury Villa 4B',
              body: 'Visit Details:\n• Buyer: Sophia Martinez (Financing approved via Silicon Valley Bank)\n• Property: Emerald Valley Luxury Villa 4B (3,950 Sq.ft)\n• Date & Time: Oct 28, 2026 at 2:00 PM\n• Status: Completed\n• Assigned Agent: Elena Rostova\n• Feedback & Notes: Buyer loved the landscaped courtyard and modern European kitchen. Preparing purchase offer at $1.62M.\n• Next Action Date: Oct 29, 2026 (Submit counter-offer documents)',
            },
            {
              id: '55555555-0003-4000-8000-000000000003',
              title: 'Site Visit: Devin Chen @ Oasis Commercial Plaza Suite 300',
              body: 'Visit Details:\n• Buyer: Devin Chen (Chen Holdings LLC)\n• Property: Oasis Commercial Plaza Suite 300 (3,200 Sq.ft)\n• Date & Time: Oct 29, 2026 at 11:00 AM\n• Status: Scheduled\n• Assigned Agent: Marcus Vance\n• Feedback & Notes: Inspection for 45 tech workstations and server room cooling capacity.\n• Next Action Date: Nov 03, 2026 (Tenant Improvement budget agreement)',
            },
            {
              id: '55555555-0004-4000-8000-000000000004',
              title: 'Site Visit: Priya Sharma @ Grand Horizon Residences Apt 1204',
              body: 'Visit Details:\n• Buyer: Dr. Priya Sharma\n• Property: Grand Horizon Residences Apt 1204 (1,350 Sq.ft)\n• Date & Time: Oct 27, 2026 at 4:30 PM\n• Status: Completed\n• Assigned Agent: Carlos Morales\n• Feedback & Notes: Verified unobstructed ocean view and allocated EV parking stalls. Submitted annual rental application.\n• Next Action Date: Oct 29, 2026 (Execute digital lease signing)',
            },
            {
              id: '55555555-0005-4000-8000-000000000005',
              title: "Site Visit: Michael O'Connor @ Sunset Bay Waterfront Villa",
              body: "Visit Details:\n• Buyer: Michael O'Connor (Private Equity)\n• Property: Sunset Bay Waterfront Villa (5,600 Sq.ft with Private Boat Slip)\n• Date & Time: Oct 25, 2026 at 1:00 PM\n• Status: Completed\n• Assigned Agent: Marcus Vance\n• Feedback & Notes: Comprehensive structural and boat dock inspection passed with buyer's architect. Offer of $3.15M accepted!\n• Next Action Date: Oct 28, 2026 (Wire escrow deposit)",
            },
            {
              id: '55555555-0006-4000-8000-000000000006',
              title: 'Site Visit: Rachel Green @ Harmony Heights 3BHK Residence',
              body: 'Visit Details:\n• Buyer: Rachel Green\n• Property: Harmony Heights 3BHK (1,850 Sq.ft)\n• Date & Time: Nov 02, 2026 at 3:00 PM\n• Status: Scheduled\n• Assigned Agent: Elena Rostova\n• Feedback & Notes: First-time home buyer visit with family. Requested floor plan measurements and HOA bylaws.\n• Next Action Date: Nov 04, 2026 (Mortgage pre-approval verification)',
            },
            {
              id: '55555555-0007-4000-8000-000000000007',
              title: 'Site Visit: Vikram Patel @ Silicon Square Tech Hub Unit 10',
              body: 'Visit Details:\n• Buyer: Vikram Patel (GreenTech Solutions)\n• Property: Silicon Square Tech Hub Unit 10 (4,100 Sq.ft)\n• Date & Time: Oct 24, 2026 at 10:00 AM\n• Status: Completed\n• Assigned Agent: Carlos Morales\n• Feedback & Notes: Commercial zoning and high-speed dedicated fiber connection verified. Buyer moving to negotiation stage.\n• Next Action Date: Oct 30, 2026 (Letter of Intent review)',
            },
            {
              id: '55555555-0008-4000-8000-000000000008',
              title: 'Site Visit: Emma Watson @ Greenfield Premium Villa Plot 18',
              body: 'Visit Details:\n• Buyer: Emma Watson\n• Property: Greenfield Premium Villa Plot 18 (10,000 Sq.ft Plot)\n• Date & Time: Oct 31, 2026 at 11:30 AM\n• Status: Scheduled\n• Assigned Agent: Elena Rostova\n• Feedback & Notes: Soil test geotechnical report and boundary topographical survey to be provided during visit.\n• Next Action Date: Nov 02, 2026 (Architect design feasibility review)',
            },
          ];

          for (let i = 0; i < visits.length; i++) {
            const v = visits[i];
            const l = leads[i];
            await c.query(`
              INSERT INTO ${dbSchema}.note (
                id, title, "bodyV2Markdown",
                position, "createdByName", "updatedByName", "createdBySource", "updatedBySource", "createdAt", "updatedAt"
              ) VALUES (
                $1, $2, $3,
                $4, 'System', 'System', 'MANUAL', 'MANUAL', NOW(), NOW()
              );
            `, [v.id, v.title, v.body, i]);

            // Database relation: Buyers & Leads -> Site Visits & Property Listings -> Site Visits
            await c.query(`
              INSERT INTO ${dbSchema}."noteTarget" (
                id, "noteId", "targetPersonId", "targetCompanyId",
                position, "createdByName", "updatedByName", "createdBySource", "updatedBySource", "createdAt", "updatedAt"
              ) VALUES (
                gen_random_uuid(), $1, $2, $3,
                $4, 'System', 'System', 'MANUAL', 'MANUAL', NOW(), NOW()
              );
            `, [v.id, l.id, l.propId, i]);
          }

          // D. Deals (opportunity table) - 8 Deals
          const deals = [
            {
              id: '66666666-0001-4000-8000-000000000001',
              name: 'Deal: Skyline Grand Penthouse Purchase - Alexander Wright',
              amount: 2400000,
              stage: 'NEGOTIATION',
              propId: '33333333-0001-4000-8000-000000000001',
              leadId: '44444444-0001-4000-8000-000000000001',
            },
            {
              id: '66666666-0002-4000-8000-000000000002',
              name: 'Deal: Emerald Valley Villa 4B Acquisition - Sophia Martinez',
              amount: 1620000,
              stage: 'DOCUMENTATION',
              propId: '33333333-0002-4000-8000-000000000002',
              leadId: '44444444-0002-4000-8000-000000000002',
            },
            {
              id: '66666666-0003-4000-8000-000000000003',
              name: 'Deal: Oasis Commercial Plaza 5-Year Lease - Devin Chen',
              amount: 105000,
              stage: 'NEW_DEAL',
              propId: '33333333-0004-4000-8000-000000000004',
              leadId: '44444444-0003-4000-8000-000000000003',
            },
            {
              id: '66666666-0004-4000-8000-000000000004',
              name: 'Deal: Grand Horizon Apt 1204 Annual Lease - Priya Sharma',
              amount: 57600,
              stage: 'DOCUMENTATION',
              propId: '33333333-0003-4000-8000-000000000003',
              leadId: '44444444-0004-4000-8000-000000000004',
            },
            {
              id: '66666666-0005-4000-8000-000000000005',
              name: "Deal: Sunset Bay Waterfront Villa Closing - Michael O'Connor",
              amount: 3150000,
              stage: 'CLOSED_WON',
              propId: '33333333-0005-4000-8000-000000000005',
              leadId: '44444444-0005-4000-8000-000000000005',
            },
            {
              id: '66666666-0006-4000-8000-000000000006',
              name: 'Deal: Harmony Heights 3BHK Initial Offer - Rachel Green',
              amount: 765000,
              stage: 'NEW_DEAL',
              propId: '33333333-0006-4000-8000-000000000006',
              leadId: '44444444-0006-4000-8000-000000000006',
            },
            {
              id: '66666666-0007-4000-8000-000000000007',
              name: 'Deal: Silicon Square Tech Hub Acquisition - Vikram Patel',
              amount: 1800000,
              stage: 'NEGOTIATION',
              propId: '33333333-0007-4000-8000-000000000007',
              leadId: '44444444-0007-4000-8000-000000000007',
            },
            {
              id: '66666666-0008-4000-8000-000000000008',
              name: 'Deal: Greenfield Villa Plot 18 Contract - Emma Watson',
              amount: 440000,
              stage: 'NEW_DEAL',
              propId: '33333333-0008-4000-8000-000000000008',
              leadId: '44444444-0008-4000-8000-000000000008',
            },
          ];

          for (let i = 0; i < deals.length; i++) {
            const d = deals[i];
            await c.query(`
              INSERT INTO ${dbSchema}.opportunity (
                id, name, "amountAmountMicros", "amountCurrencyCode", stage, "closeDate", "companyId", "pointOfContactId",
                position, "createdByName", "updatedByName", "createdBySource", "updatedBySource", "createdAt", "updatedAt"
              ) VALUES (
                $1, $2, $3, 'USD', $4, NOW() + interval '21 days', $5, $6,
                $7, 'System', 'System', 'MANUAL', 'MANUAL', NOW(), NOW()
              );
            `, [d.id, d.name, d.amount * 1000000, d.stage, d.propId, d.leadId, i]);
          }

          // E. Follow-ups (task table) - 8 Follow-ups
          const followUps = [
            {
              id: '77777777-0001-4000-8000-000000000001',
              title: 'Call: Alexander Wright - Counter-offer review on penthouse deed & escrow timeline',
              status: 'TODO',
            },
            {
              id: '77777777-0002-4000-8000-000000000002',
              title: 'Meeting: Sophia Martinez - Finalize title deed documentation & notary appointment',
              status: 'TODO',
            },
            {
              id: '77777777-0003-4000-8000-000000000003',
              title: 'Message: Devin Chen - Send revised commercial lease with tenant improvement allowance',
              status: 'TODO',
            },
            {
              id: '77777777-0004-4000-8000-000000000004',
              title: 'Email: Priya Sharma - Send digital lease agreement & security deposit payment link',
              status: 'DONE',
            },
            {
              id: '77777777-0005-4000-8000-000000000005',
              title: "Meeting: Michael O'Connor - Handover villa keys and smart home access credentials",
              status: 'DONE',
            },
            {
              id: '77777777-0006-4000-8000-000000000006',
              title: 'Call: Rachel Green - Confirm pre-approval letter from Chase Mortgage',
              status: 'TODO',
            },
            {
              id: '77777777-0007-4000-8000-000000000007',
              title: 'Email: Vikram Patel - Provide commercial environmental clearance certificate',
              status: 'IN_PROGRESS',
            },
            {
              id: '77777777-0008-4000-8000-000000000008',
              title: 'Call: Emma Watson - Coordinate site survey engineer for plot boundary demarcation',
              status: 'TODO',
            },
          ];

          for (let i = 0; i < followUps.length; i++) {
            const fu = followUps[i];
            const lead = leads[i];
            const deal = deals[i];
            await c.query(`
              INSERT INTO ${dbSchema}.task (
                id, title, "bodyV2Markdown", status, "dueAt",
                position, "createdByName", "updatedByName", "createdBySource", "updatedBySource", "createdAt", "updatedAt"
              ) VALUES (
                $1, $2, $3, $4, NOW() + interval '2 days',
                $5, 'System', 'System', 'MANUAL', 'MANUAL', NOW(), NOW()
              );
            `, [fu.id, fu.title, fu.title, fu.status, i]);

            // Database relation: Buyers & Leads -> Follow-ups, Property Listings -> Follow-ups, Deals -> Follow-ups
            await c.query(`
              INSERT INTO ${dbSchema}."taskTarget" (
                id, "taskId", "targetPersonId", "targetCompanyId", "targetOpportunityId",
                position, "createdByName", "updatedByName", "createdBySource", "updatedBySource", "createdAt", "updatedAt"
              ) VALUES (
                gen_random_uuid(), $1, $2, $3, $4,
                $5, 'System', 'System', 'MANUAL', 'MANUAL', NOW(), NOW()
              );
            `, [fu.id, lead.id, lead.propId, deal.id, i]);
          }

          // F. Reports (dashboard table) - 6 Analytics Reports
          const realEstateReports = [
            {
              id: '88888888-0001-4000-8000-000000000001',
              title: 'Total Active Property Listings: 8 Properties ($10.8M Portfolio Value, 75% Available / Reserved)',
            },
            {
              id: '88888888-0002-4000-8000-000000000002',
              title: 'New Leads by Source: Website (38%), Ads (29%), Referrals (25%), Walk-in (8%)',
            },
            {
              id: '88888888-0003-4000-8000-000000000003',
              title: 'Upcoming & Completed Site Visits: 84% Attendance Rate, 62% Conversion to Deal Negotiation',
            },
            {
              id: '88888888-0004-4000-8000-000000000004',
              title: 'Deals by Pipeline Stage: $8.9M in Active Negotiations, $3.15M Closed Won This Quarter',
            },
            {
              id: '88888888-0005-4000-8000-000000000005',
              title: 'Closed Sales & Rental Deals: Average Time-to-Close 28 Days, Average Commission 4.8%',
            },
            {
              id: '88888888-0006-4000-8000-000000000006',
              title: 'Agent Performance & Follow-up Compliance: 94% On-time Resolution Across All Brokers',
            },
          ];

          for (let i = 0; i < realEstateReports.length; i++) {
            const rep = realEstateReports[i];
            await c.query(`
              INSERT INTO ${dbSchema}.dashboard (
                id, title,
                position, "createdByName", "updatedByName", "createdBySource", "updatedBySource", "createdAt", "updatedAt"
              ) VALUES (
                $1, $2,
                $3, 'System', 'System', 'MANUAL', 'MANUAL', NOW(), NOW()
              );
            `, [rep.id, rep.title, i]);
          }

          console.log(`Successfully purged SaaS demo data and seeded Pure Real Estate records into ${dbSchema}!`);
        } catch (reErr) {
          console.error(`Error populating real estate data for schema ${dbSchema}:`, reErr.message);
        }
      }
    } else if (industry === 'others' || industry === 'cars') {
      console.log(`Configuring Pure Standard CRM (Lead, Opportunity, Contact, Company, Task) for workspace: ${wsId}`);

      // 1. Update Core Object Metadata Labels and Icons to Standard CRM
      await c.query(`
        UPDATE core."objectMetadata"
        SET "labelPlural" = 'Leads', "labelSingular" = 'Lead', icon = 'IconUserSearch', color = 'sky', "isActive" = true
        WHERE "workspaceId" = '${wsId}' AND "nameSingular" = 'note';

        UPDATE core."objectMetadata"
        SET "labelPlural" = 'Opportunities', "labelSingular" = 'Opportunity', icon = 'IconTarget', color = 'orange', "isActive" = true
        WHERE "workspaceId" = '${wsId}' AND "nameSingular" = 'opportunity';

        UPDATE core."objectMetadata"
        SET "labelPlural" = 'Contacts', "labelSingular" = 'Contact', icon = 'IconUser', color = 'teal', "isActive" = true
        WHERE "workspaceId" = '${wsId}' AND "nameSingular" = 'person';

        UPDATE core."objectMetadata"
        SET "labelPlural" = 'Companies', "labelSingular" = 'Company', icon = 'IconBuildingSkyscraper', color = 'blue', "isActive" = true
        WHERE "workspaceId" = '${wsId}' AND "nameSingular" = 'company';

        UPDATE core."objectMetadata"
        SET "labelPlural" = 'Tasks', "labelSingular" = 'Task', icon = 'IconChecklist', color = 'purple', "isActive" = true
        WHERE "workspaceId" = '${wsId}' AND "nameSingular" = 'task';

        UPDATE core."objectMetadata"
        SET "labelPlural" = 'Dashboards', "labelSingular" = 'Dashboard', icon = 'IconChartPie', color = 'green', "isActive" = false
        WHERE "workspaceId" = '${wsId}' AND "nameSingular" = 'dashboard';

        UPDATE core."objectMetadata"
        SET "labelPlural" = 'Workspace Members', "labelSingular" = 'Workspace Member', icon = 'IconUserCheck', color = 'purple', "isActive" = true
        WHERE "workspaceId" = '${wsId}' AND "nameSingular" = 'workspaceMember';

        UPDATE core."objectMetadata"
        SET "isActive" = false
        WHERE "workspaceId" = '${wsId}' AND "nameSingular" IN (
          'product', 'productionOrder', 'rawMaterial', 'supplier', 'inventoryItem', 'qualityReport',
          'patient', 'doctor', 'appointment', 'department', 'medicalRecord', 'workflow'
        );
      `);

      // 2. Fetch Object IDs and Application ID
      const metas = await c.query(`
        SELECT id, "nameSingular"
        FROM core."objectMetadata"
        WHERE "workspaceId" = $1;
      `, [wsId]);

      const metaMap = {};
      metas.rows.forEach(r => { metaMap[r.nameSingular] = r.id; });

      const noteObjId = metaMap['note']; // Lead
      const oppObjId = metaMap['opportunity']; // Opportunity
      const personObjId = metaMap['person']; // Contact
      const compObjId = metaMap['company']; // Company
      const taskObjId = metaMap['task']; // Task

      let appId = null;
      const appRes = await c.query(`SELECT id FROM core."application" WHERE "workspaceId" = $1 LIMIT 1`, [wsId]);
      if (appRes.rows.length > 0) {
        appId = appRes.rows[0].id;
      } else {
        const newApp = await c.query(`
          INSERT INTO core."application" (id, "workspaceId", "createdAt", "updatedAt")
          VALUES (gen_random_uuid(), $1, NOW(), NOW()) RETURNING id;
        `, [wsId]);
        appId = newApp.rows[0].id;
      }

      // 3. Add Standard Sales Stages to opportunity_stage_enum and fieldMetadata
      if (dbSchema) {
        const enumStages = [
          'NEW', 'CONTACTED', 'MEETING', 'PROPOSAL', 'NEGOTIATION', 'CLOSED_WON', 'CLOSED_LOST'
        ];
        for (const stageVal of enumStages) {
          try {
            await c.query(`ALTER TYPE ${dbSchema}.opportunity_stage_enum ADD VALUE IF NOT EXISTS '${stageVal}'`);
          } catch (e) {}
        }
      }

      if (oppObjId) {
        const oppStageField = await c.query(`
          SELECT id FROM core."fieldMetadata" WHERE "objectMetadataId" = $1 AND name = 'stage' LIMIT 1
        `, [oppObjId]);

        if (oppStageField.rows.length > 0) {
          await c.query(`
            UPDATE core."fieldMetadata"
            SET options = '[
              {"id": "60606060-0001-4afd-9c39-d2063097587a", "color": "sky", "label": "New", "value": "NEW", "position": 0},
              {"id": "60606060-0002-4671-ac32-26d304dacb6e", "color": "blue", "label": "Contacted", "value": "CONTACTED", "position": 1},
              {"id": "60606060-0003-4acc-b5ca-f6531a8ecb4a", "color": "yellow", "label": "Meeting Scheduled", "value": "MEETING", "position": 2},
              {"id": "60606060-0004-4f6b-91bc-f413e9b2f654", "color": "purple", "label": "Proposal Sent", "value": "PROPOSAL", "position": 3},
              {"id": "60606060-0005-4a6f-a8b2-774bbad21104", "color": "orange", "label": "Negotiation", "value": "NEGOTIATION", "position": 4},
              {"id": "60606060-0006-4a6f-a8b2-774bbad21105", "color": "green", "label": "Closed Won", "value": "CLOSED_WON", "position": 5},
              {"id": "60606060-0007-4a6f-a8b2-774bbad21106", "color": "red", "label": "Closed Lost", "value": "CLOSED_LOST", "position": 6}
            ]'::jsonb
            WHERE id = $1;
          `, [oppStageField.rows[0].id]);
        }

        // Configure Views for Opportunity
        await c.query(`
          UPDATE core."view"
          SET name = 'Sales Pipeline', icon = 'IconTarget'
          WHERE "objectMetadataId" = '${oppObjId}' AND type = 'KANBAN';

          UPDATE core."view"
          SET name = 'All Opportunities', icon = 'IconTarget'
          WHERE "objectMetadataId" = '${oppObjId}' AND type = 'TABLE' AND key = 'INDEX';
        `);

        const kanbanViewRes = await c.query(`
          SELECT id FROM core."view" WHERE "objectMetadataId" = $1 AND type = 'KANBAN' LIMIT 1
        `, [oppObjId]);
        if (kanbanViewRes.rows.length > 0) {
          const kanbanViewId = kanbanViewRes.rows[0].id;
          await c.query(`DELETE FROM core."viewGroup" WHERE "viewId" = $1`, [kanbanViewId]);
          const salesStages = ['NEW', 'CONTACTED', 'MEETING', 'PROPOSAL', 'NEGOTIATION', 'CLOSED_WON', 'CLOSED_LOST'];
          for (let sIdx = 0; sIdx < salesStages.length; sIdx++) {
            await c.query(`
              INSERT INTO core."viewGroup" (id, "universalIdentifier", "viewId", "fieldValue", "isVisible", position, "workspaceId", "applicationId", "createdAt", "updatedAt")
              VALUES (gen_random_uuid(), gen_random_uuid(), $1, $2, true, $3, $4, $5, NOW(), NOW())
            `, [kanbanViewId, salesStages[sIdx], sIdx, wsId, appId]);
          }
        }
      }

      if (noteObjId) {
        await c.query(`
          UPDATE core."view"
          SET name = 'All Leads', icon = 'IconUserSearch'
          WHERE "objectMetadataId" = $1 AND key = 'INDEX';
        `, [noteObjId]);
      }

      if (personObjId) {
        await c.query(`
          UPDATE core."view"
          SET name = 'All Contacts', icon = 'IconUser'
          WHERE "objectMetadataId" = $1 AND key = 'INDEX';
        `, [personObjId]);
      }

      if (compObjId) {
        await c.query(`
          UPDATE core."view"
          SET name = 'All Companies', icon = 'IconBuildingSkyscraper'
          WHERE "objectMetadataId" = $1 AND key = 'INDEX';
        `, [compObjId]);
      }

      if (taskObjId) {
        await c.query(`
          UPDATE core."view"
          SET name = 'All Tasks', icon = 'IconChecklist'
          WHERE "objectMetadataId" = $1;
        `, [taskObjId]);
      }

      // 4. CLEAN AND RECONFIGURE NAVIGATION MENU ITEMS - EXACTLY 5 MODULES: Lead, Opportunity, Contact, Company, Task
      await c.query(`DELETE FROM core."navigationMenuItem" WHERE "workspaceId" = $1;`, [wsId]);

      const othersNav = [
        { objId: noteObjId, name: 'Lead', color: 'sky', icon: 'IconUserSearch', pos: 0 },
        { objId: oppObjId, name: 'Opportunity', color: 'orange', icon: 'IconTarget', pos: 1 },
        { objId: personObjId, name: 'Contact', color: 'teal', icon: 'IconUser', pos: 2 },
        { objId: compObjId, name: 'Company', color: 'blue', icon: 'IconBuildingSkyscraper', pos: 3 },
        { objId: taskObjId, name: 'Task', color: 'purple', icon: 'IconChecklist', pos: 4 },
      ];

      for (const item of othersNav) {
        if (item.objId && appId) {
          await c.query(`
            INSERT INTO core."navigationMenuItem" (
              id, "universalIdentifier", "workspaceId", "applicationId", "targetObjectMetadataId", position, type, color, icon, name, "createdAt", "updatedAt"
            ) VALUES (
              gen_random_uuid(), gen_random_uuid(), $1, $2, $3, $4, 'OBJECT', $5, $6, $7, NOW(), NOW()
            );
          `, [wsId, appId, item.objId, item.pos, item.color, item.icon, item.name]);
        }
      }

      // 5. Seed authentic Standard CRM records
      if (dbSchema) {
        try {
          await c.query(`
            DELETE FROM ${dbSchema}."timelineActivity";
            DELETE FROM ${dbSchema}."taskTarget";
            DELETE FROM ${dbSchema}.task;
            DELETE FROM ${dbSchema}.opportunity;
            DELETE FROM ${dbSchema}.person;
            DELETE FROM ${dbSchema}.company;
            DELETE FROM ${dbSchema}.note;
            DELETE FROM ${dbSchema}.dashboard;
          `);

          // A. Companies (company) - 8 Companies
          const companies = [
            { id: '22222222-0001-7000-8000-000000000001', name: 'Stripe Payments Inc', domain: 'stripe.com', contact: 'Sarah Jenkins (VP Eng)', street: '510 Townsend Street', city: 'San Francisco, CA' },
            { id: '22222222-0002-7000-8000-000000000002', name: 'Acme Global Enterprises', domain: 'acmeglobal.com', contact: 'David Miller (CTO)', street: '350 Fifth Avenue', city: 'New York, NY' },
            { id: '22222222-0003-7000-8000-000000000003', name: 'NovaTech AI Systems', domain: 'novatech.ai', contact: 'Emily Zhang (Head of AI)', street: '1100 Congress Avenue', city: 'Austin, TX' },
            { id: '22222222-0004-7000-8000-000000000004', name: 'Apex Logistics & Freight', domain: 'apexlogistics.com', contact: 'Marcus Thorne (Ops Dir)', street: '800 Michigan Avenue', city: 'Chicago, IL' },
            { id: '22222222-0005-7000-8000-000000000005', name: 'CloudScale Infrastructure', domain: 'cloudscale.io', contact: 'Jessica Taylor (VP Cloud)', street: '400 Pine Street', city: 'Seattle, WA' },
            { id: '22222222-0006-7000-8000-000000000006', name: 'Vanguard Health Technologies', domain: 'vanguardhealth.org', contact: 'Dr. Daniel Bennett (VP)', street: '75 Cambridge Parkway', city: 'Boston, MA' },
            { id: '22222222-0007-7000-8000-000000000007', name: 'CyberShield Security Labs', domain: 'cybershield.net', contact: 'Robert Hayes (CISO)', street: '1600 17th Street', city: 'Denver, CO' },
            { id: '22222222-0008-7000-8000-000000000008', name: 'Summit Media & Marketing', domain: 'summitmedia.com', contact: 'Amanda Ross (Managing Dir)', street: '9000 Sunset Boulevard', city: 'Los Angeles, CA' },
          ];

          for (let i = 0; i < companies.length; i++) {
            const comp = companies[i];
            await c.query(`
              INSERT INTO ${dbSchema}.company (
                id, name, "domainNamePrimaryLinkLabel", "domainNamePrimaryLinkUrl", "linkedinLinkPrimaryLinkLabel", "linkedinLinkPrimaryLinkUrl", "addressAddressStreet1", "addressAddressCity",
                position, "createdByName", "updatedByName", "createdBySource", "updatedBySource", "createdAt", "updatedAt"
              ) VALUES (
                $1, $2, $3, 'https://' || $3, $4, 'https://linkedin.com', $5, $6,
                $7, 'System', 'System', 'MANUAL', 'MANUAL', NOW(), NOW()
              );
            `, [comp.id, comp.name, comp.domain, comp.contact, comp.street, comp.city, i]);
          }

          // B. Contacts (person) - 8 Contacts
          const contacts = [
            { id: '33333333-0001-7000-8000-000000000001', first: 'Sarah', last: 'Jenkins', email: 'sarah.jenkins@stripe.com', phone: '+1 (415) 555-0101', title: 'VP Engineering', city: 'San Francisco, CA', compId: '22222222-0001-7000-8000-000000000001' },
            { id: '33333333-0002-7000-8000-000000000002', first: 'David', last: 'Miller', email: 'david.miller@acmeglobal.com', phone: '+1 (212) 555-0102', title: 'Chief Technology Officer', city: 'New York, NY', compId: '22222222-0002-7000-8000-000000000002' },
            { id: '33333333-0003-7000-8000-000000000003', first: 'Emily', last: 'Zhang', email: 'emily.zhang@novatech.ai', phone: '+1 (512) 555-0103', title: 'Head of AI & ML', city: 'Austin, TX', compId: '22222222-0003-7000-8000-000000000003' },
            { id: '33333333-0004-7000-8000-000000000004', first: 'Marcus', last: 'Thorne', email: 'marcus.thorne@apexlogistics.com', phone: '+1 (312) 555-0104', title: 'Operations Director', city: 'Chicago, IL', compId: '22222222-0004-7000-8000-000000000004' },
            { id: '33333333-0005-7000-8000-000000000005', first: 'Jessica', last: 'Taylor', email: 'jessica.taylor@cloudscale.io', phone: '+1 (206) 555-0105', title: 'VP Cloud Operations', city: 'Seattle, WA', compId: '22222222-0005-7000-8000-000000000005' },
            { id: '33333333-0006-7000-8000-000000000006', first: 'Dr. Daniel', last: 'Bennett', email: 'daniel.bennett@vanguardhealth.org', phone: '+1 (617) 555-0106', title: 'VP Clinical Informatics', city: 'Boston, MA', compId: '22222222-0006-7000-8000-000000000006' },
            { id: '33333333-0007-7000-8000-000000000007', first: 'Robert', last: 'Hayes', email: 'robert.hayes@cybershield.net', phone: '+1 (303) 555-0107', title: 'CISO', city: 'Denver, CO', compId: '22222222-0007-7000-8000-000000000007' },
            { id: '33333333-0008-7000-8000-000000000008', first: 'Amanda', last: 'Ross', email: 'amanda.ross@summitmedia.com', phone: '+1 (310) 555-0108', title: 'Managing Director', city: 'Los Angeles, CA', compId: '22222222-0008-7000-8000-000000000008' },
          ];

          for (let i = 0; i < contacts.length; i++) {
            const ct = contacts[i];
            await c.query(`
              INSERT INTO ${dbSchema}.person (
                id, "nameFirstName", "nameLastName", "emailsPrimaryEmail", "phonesPrimaryPhoneNumber", "jobTitle", city, "companyId",
                position, "createdByName", "updatedByName", "createdBySource", "updatedBySource", "createdAt", "updatedAt"
              ) VALUES (
                $1, $2, $3, $4, $5, $6, $7, $8,
                $9, 'System', 'System', 'MANUAL', 'MANUAL', NOW(), NOW()
              );
            `, [ct.id, ct.first, ct.last, ct.email, ct.phone, ct.title, ct.city, ct.compId, i]);
          }

          // C. Leads (note) - 8 Leads
          const leads = [
            { id: '44444444-0001-7000-8000-000000000001', title: 'Lead: Sarah Jenkins @ Stripe Payments', body: 'Source: Website Inbound | Requirement: Enterprise Platform Licensing | Status: Qualified | Budget: $120k | Notes: Looking to automate customer lifecycle operations across all regional teams.' },
            { id: '44444444-0002-7000-8000-000000000002', title: 'Lead: David Miller @ Acme Global', body: 'Source: Partner Referral | Requirement: Global ERP & CRM Integration | Status: Discovery Call Scheduled | Budget: $240k | Notes: RFP under final executive evaluation.' },
            { id: '44444444-0003-7000-8000-000000000003', title: 'Lead: Emily Zhang @ NovaTech AI', body: 'Source: Y-Combinator Network | Requirement: Agentic Workflows Deployment | Status: Demo Completed | Budget: $85k | Notes: Fast growing AI team seeking workflow automation.' },
            { id: '44444444-0004-7000-8000-000000000004', title: 'Lead: Marcus Thorne @ Apex Logistics', body: 'Source: Webinar Inbound | Requirement: Fleet Operations CRM | Status: Contacted | Budget: $60k | Notes: Needs automated tracking and webhook integrations.' },
            { id: '44444444-0005-7000-8000-000000000005', title: 'Lead: Jessica Taylor @ CloudScale', body: 'Source: Outbound SDR | Requirement: Multi-Region Migration | Status: Proposal Review | Budget: $175k | Notes: Evaluating SLA guarantees and SOC2 compliance.' },
            { id: '44444444-0006-7000-8000-000000000006', title: 'Lead: Dr. Daniel Bennett @ Vanguard', body: 'Source: HealthTech 2026 Conference | Requirement: HIPAA Compliant Patient Outreach | Status: Proposal Sent | Budget: $95k | Notes: Requires signed BAA.' },
            { id: '44444444-0007-7000-8000-000000000007', title: 'Lead: Robert Hayes @ CyberShield', body: 'Source: Security Audit RFP | Requirement: SOC2 Managed Workflow | Status: Final Negotiation | Budget: $110k | Notes: Security committee approved.' },
            { id: '44444444-0008-7000-8000-000000000008', title: 'Lead: Amanda Ross @ Summit Media', body: 'Source: Google Ads Campaign | Requirement: Multi-Channel Attribution CRM | Status: New Inquiry | Budget: $45k | Notes: Marketing agency looking for client portal.' },
          ];

          for (let i = 0; i < leads.length; i++) {
            const ld = leads[i];
            await c.query(`
              INSERT INTO ${dbSchema}.note (
                id, title, body,
                position, "createdByName", "updatedByName", "createdBySource", "updatedBySource", "createdAt", "updatedAt"
              ) VALUES (
                $1, $2, $3,
                $4, 'System', 'System', 'MANUAL', 'MANUAL', NOW(), NOW()
              );
            `, [ld.id, ld.title, ld.body, i]);
          }

          // D. Opportunities (opportunity) - 8 Opportunities
          const opportunities = [
            { id: '55555555-0001-7000-8000-000000000001', name: 'Enterprise Platform License - Stripe', amount: 120000, stage: 'PROPOSAL', compId: '22222222-0001-7000-8000-000000000001', pocId: '33333333-0001-7000-8000-000000000001' },
            { id: '55555555-0002-7000-8000-000000000002', name: 'Global ERP Integration - Acme', amount: 240000, stage: 'NEGOTIATION', compId: '22222222-0002-7000-8000-000000000002', pocId: '33333333-0002-7000-8000-000000000002' },
            { id: '55555555-0003-7000-8000-000000000003', name: 'AI Workflows Deployment - NovaTech', amount: 85000, stage: 'MEETING', compId: '22222222-0003-7000-8000-000000000003', pocId: '33333333-0003-7000-8000-000000000003' },
            { id: '55555555-0004-7000-8000-000000000004', name: 'Fleet Automation Suite - Apex', amount: 60000, stage: 'CONTACTED', compId: '22222222-0004-7000-8000-000000000004', pocId: '33333333-0004-7000-8000-000000000004' },
            { id: '55555555-0005-7000-8000-000000000005', name: 'Multi-Region Cloud Migration - CloudScale', amount: 175000, stage: 'CLOSED_WON', compId: '22222222-0005-7000-8000-000000000005', pocId: '33333333-0005-7000-8000-000000000005' },
            { id: '55555555-0006-7000-8000-000000000006', name: 'HIPAA Compliance Module - Vanguard', amount: 95000, stage: 'PROPOSAL', compId: '22222222-0006-7000-8000-000000000006', pocId: '33333333-0006-7000-8000-000000000006' },
            { id: '55555555-0007-7000-8000-000000000007', name: 'SOC2 Managed Security Audit - CyberShield', amount: 110000, stage: 'NEGOTIATION', compId: '22222222-0007-7000-8000-000000000007', pocId: '33333333-0007-7000-8000-000000000007' },
            { id: '55555555-0008-7000-8000-000000000008', name: 'Marketing CRM Rollout - Summit Media', amount: 45000, stage: 'NEW', compId: '22222222-0008-7000-8000-000000000008', pocId: '33333333-0008-7000-8000-000000000008' },
          ];

          for (let i = 0; i < opportunities.length; i++) {
            const opp = opportunities[i];
            await c.query(`
              INSERT INTO ${dbSchema}.opportunity (
                id, name, amount, stage, "closeDate", "companyId", "pointOfContactId",
                position, "createdByName", "updatedByName", "createdBySource", "updatedBySource", "createdAt", "updatedAt"
              ) VALUES (
                $1, $2, $3, $4, NOW() + interval '30 days', $5, $6,
                $7, 'System', 'System', 'MANUAL', 'MANUAL', NOW(), NOW()
              );
            `, [opp.id, opp.name, opp.amount, opp.stage, opp.compId, opp.pocId, i]);
          }

          // E. Tasks (task) - 8 Tasks
          const tasks = [
            { id: '66666666-0001-7000-8000-000000000001', title: 'Call: Sarah Jenkins - Review contract SLA & security compliance', status: 'TODO' },
            { id: '66666666-0002-7000-8000-000000000002', title: 'Meeting: David Miller - Architecture review with solution engineering', status: 'TODO' },
            { id: '66666666-0003-7000-8000-000000000003', title: 'Demo: Emily Zhang - Live demo of automated agentic workflows', status: 'TODO' },
            { id: '66666666-0004-7000-8000-000000000004', title: 'Email: Marcus Thorne - Send pricing quotation and volume discount', status: 'DONE' },
            { id: '66666666-0005-7000-8000-000000000005', title: 'Call: Jessica Taylor - Welcome call & customer success onboarding', status: 'DONE' },
            { id: '66666666-0006-7000-8000-000000000006', title: 'Message: Dr. Daniel Bennett - Send HIPAA BAA document for legal review', status: 'TODO' },
            { id: '66666666-0007-7000-8000-000000000007', title: 'Meeting: Robert Hayes - Security review meeting with CISO team', status: 'IN_PROGRESS' },
            { id: '66666666-0008-7000-8000-000000000008', title: 'Call: Amanda Ross - Scope requirements for multi-channel attribution', status: 'TODO' },
          ];

          for (let i = 0; i < tasks.length; i++) {
            const tk = tasks[i];
            await c.query(`
              INSERT INTO ${dbSchema}.task (
                id, title, status, "dueAt",
                position, "createdByName", "updatedByName", "createdBySource", "updatedBySource", "createdAt", "updatedAt"
              ) VALUES (
                $1, $2, $3, NOW() + interval '3 days',
                $4, 'System', 'System', 'MANUAL', 'MANUAL', NOW(), NOW()
              );
            `, [tk.id, tk.title, tk.status, i]);
          }

          console.log(`Successfully purged SaaS demo data and seeded Pure Standard CRM records into ${dbSchema}!`);
        } catch (stdErr) {
          console.error(`Error populating standard CRM data for schema ${dbSchema}:`, stdErr.message);
        }
      }
    }

    // Update WORKSPACE_INDUSTRY_CONFIG
    const config = {
      industry,
      updatedAt: new Date().toISOString(),
    };
    await c.query(`DELETE FROM core."keyValuePair" WHERE "workspaceId" = $1 AND key = 'WORKSPACE_INDUSTRY_CONFIG'`, [wsId]);
    await c.query(`
      INSERT INTO core."keyValuePair" (id, "workspaceId", key, value, type, "createdAt", "updatedAt")
      VALUES (gen_random_uuid(), $1, 'WORKSPACE_INDUSTRY_CONFIG', $2::jsonb, 'USER_VARIABLE', NOW(), NOW())
    `, [wsId, JSON.stringify(config)]);

    // Bump metadataVersion
    await c.query(`
      UPDATE core.workspace SET "metadataVersion" = "metadataVersion" + 1 WHERE id = $1;
    `, [wsId]);
  }

  // Flush Redis cache so frontend immediately picks up updated metadata and navigation
  try {
    const { createClient } = require('redis');
    const r = createClient({ url: process.env.REDIS_URL });
    await r.connect();
    await r.flushAll();
    await r.disconnect();
    console.log('Redis cache flushed successfully.');
  } catch (err) {
    console.warn('Redis flush warning:', err.message);
  }

  console.log(`Industry template "${industry}" successfully applied!`);
  await c.end();
}

module.exports = { applyIndustry };

if (require.main === module) {
  const ind = process.argv[2] || 'healthcare';
  const targetWs = process.argv[3];
  applyIndustry(ind, targetWs).catch(console.error);
}
