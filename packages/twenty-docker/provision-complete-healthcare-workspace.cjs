const { Client } = require('pg');
const { createClient } = require('redis');

const MODULE_PATH_BASE = '/app/packages/twenty-server/dist';

function getPgConnectionString() {
  return process.env.PG_DATABASE_URL || 'postgres://postgres:postgres@db:5432/default';
}

async function provisionHealthcareModules(app, targetWorkspaceId, options = {}) {
  const { isOnboardingTemplate = true } = options;

  const { ObjectMetadataService } = require(`${MODULE_PATH_BASE}/engine/metadata-modules/object-metadata/object-metadata.service`);
  const { FieldMetadataService } = require(`${MODULE_PATH_BASE}/engine/metadata-modules/field-metadata/services/field-metadata.service`);
  const { ViewService } = require(`${MODULE_PATH_BASE}/engine/metadata-modules/view/services/view.service`);
  const { WorkspaceCacheService } = require(`${MODULE_PATH_BASE}/engine/workspace-cache/services/workspace-cache.service`);

  const objectMetadataService = app.get(ObjectMetadataService);
  const fieldMetadataService = app.get(FieldMetadataService);
  const viewService = app.get(ViewService);
  const workspaceCacheService = app.get(WorkspaceCacheService);

  const c = new Client({ connectionString: getPgConnectionString() });
  await c.connect();

  try {
    const wsQuery = targetWorkspaceId
      ? `SELECT id, "displayName", "databaseSchema" FROM core.workspace WHERE id = $1`
      : `SELECT id, "displayName", "databaseSchema" FROM core.workspace WHERE "deletedAt" IS NULL ORDER BY "createdAt" DESC LIMIT 1`;
    const wsRes = targetWorkspaceId ? await c.query(wsQuery, [targetWorkspaceId]) : await c.query(wsQuery);
    if (wsRes.rows.length === 0) {
      throw new Error('No active target workspace found for Healthcare CRM provisioning');
    }

    const ws = wsRes.rows[0];
    const wsId = ws.id;
    const schema = ws.databaseSchema;

    console.log('=========================================================================');
    console.log(`HEALTHCARE CRM PROVISIONER - Workspace: "${ws.displayName}" (${wsId}) [${schema}]`);
    console.log('=========================================================================');

    const getObjectByName = async (nameSingular) => {
      const res = await c.query(
        `SELECT id, "nameSingular", "namePlural", "labelSingular", "labelPlural", "targetTableName"
         FROM core."objectMetadata"
         WHERE "workspaceId" = $1 AND "nameSingular" = $2`,
        [wsId, nameSingular],
      );
      return res.rows[0] || null;
    };

    const getFieldByName = async (objectMetadataId, name) => {
      const res = await c.query(
        `SELECT id, name, label, type
         FROM core."fieldMetadata"
         WHERE "workspaceId" = $1 AND "objectMetadataId" = $2 AND name = $3`,
        [wsId, objectMetadataId, name],
      );
      return res.rows[0] || null;
    };

    const ensureObject = async (def) => {
      let existing = await getObjectByName(def.nameSingular);
      if (existing) {
        console.log(`  [exists] Object ${def.nameSingular} (${existing.id})`);
        await c.query(
          `UPDATE core."objectMetadata"
           SET "isActive" = true, "isUICreatable" = true, "isUIEditable" = true, "isUIReadOnly" = false,
               "labelSingular" = $1, "labelPlural" = $2, icon = $3, color = $4, description = $5, "updatedAt" = NOW()
           WHERE id = $6`,
          [def.labelSingular, def.labelPlural, def.icon, def.color, def.description, existing.id],
        );
      } else {
        console.log(`  [create] Creating custom object ${def.nameSingular} (${def.labelPlural})...`);
        await objectMetadataService.createOneObject({
          workspaceId: wsId,
          createObjectInput: {
            nameSingular: def.nameSingular,
            namePlural: def.namePlural,
            labelSingular: def.labelSingular,
            labelPlural: def.labelPlural,
            description: def.description,
            icon: def.icon,
            color: def.color,
            isLabelSyncedWithName: false,
          },
        });
        existing = await getObjectByName(def.nameSingular);
        if (!existing) {
          throw new Error(`Failed to create object ${def.nameSingular}`);
        }
        console.log(`  [ok] Created object ${def.nameSingular} (${existing.id})`);
      }

      if (def.nameFieldLabel) {
        const nameField = await getFieldByName(existing.id, 'name');
        if (nameField && nameField.label !== def.nameFieldLabel) {
          await fieldMetadataService.updateOneField({
            workspaceId: wsId,
            updateFieldInput: {
              id: nameField.id,
              label: def.nameFieldLabel,
              description: def.nameFieldDescription || `${def.nameFieldLabel} identifier`,
              isLabelSyncedWithName: false,
            },
          });
          console.log(`    [ok] Relabeled ${def.nameSingular}.name -> "${def.nameFieldLabel}"`);
        }
      }

      return existing;
    };

    const pendingScalarFields = [];
    const pendingRelationFields = [];

    const ensureField = async (objectMetadataId, objectName, fieldDef) => {
      const existing = await getFieldByName(objectMetadataId, fieldDef.name);
      if (existing) {
        return existing;
      }
      const createFieldInput = {
        objectMetadataId,
        name: fieldDef.name,
        label: fieldDef.label,
        type: fieldDef.type,
        description: fieldDef.description || '',
        icon: fieldDef.icon || 'IconList',
        isNullable: fieldDef.isNullable !== undefined ? fieldDef.isNullable : true,
        isUnique: fieldDef.isUnique === true,
        isLabelSyncedWithName: false,
      };
      if (fieldDef.options) createFieldInput.options = fieldDef.options;
      if (fieldDef.settings) createFieldInput.settings = fieldDef.settings;
      if (fieldDef.relationCreationPayload) {
        createFieldInput.relationCreationPayload = fieldDef.relationCreationPayload;
        pendingRelationFields.push({ objectName, fieldName: fieldDef.name, input: createFieldInput });
      } else {
        pendingScalarFields.push({ objectName, fieldName: fieldDef.name, input: createFieldInput });
      }
      return null;
    };

    const flushPendingFields = async () => {
      if (pendingScalarFields.length > 0) {
        console.log(`  [batch] Creating ${pendingScalarFields.length} Healthcare scalar/select/date fields in 1 migration...`);
        try {
          await fieldMetadataService.createManyFields({
            workspaceId: wsId,
            createFieldInputs: pendingScalarFields.map((f) => f.input),
          });
        } catch (e) {
          const details = e?.failedWorkspaceMigrationBuildResult?.report ? JSON.stringify(e.failedWorkspaceMigrationBuildResult.report) : e.message;
          throw new Error('Healthcare batch scalar fields failed: ' + details);
        }
        pendingScalarFields.length = 0;
      }
      if (pendingRelationFields.length > 0) {
        console.log(`  [batch] Creating ${pendingRelationFields.length} Healthcare database-backed relation fields in 1 migration...`);
        try {
          await fieldMetadataService.createManyFields({
            workspaceId: wsId,
            createFieldInputs: pendingRelationFields.map((f) => f.input),
          });
        } catch (e) {
          const details = e?.failedWorkspaceMigrationBuildResult?.report ? JSON.stringify(e.failedWorkspaceMigrationBuildResult.report) : e.message;
          throw new Error('Healthcare batch relation fields failed: ' + details);
        }
        pendingRelationFields.length = 0;
      }
    };

    // =========================================================================
    // STEP 1: CREATE ALL 6 CUSTOM HEALTHCARE OBJECTS
    // =========================================================================
    console.log('\n[1/6] Creating Healthcare CRM custom objects...');

    const departmentObj = await ensureObject({
      nameSingular: 'department',
      namePlural: 'departments',
      labelSingular: 'Department',
      labelPlural: 'Departments',
      description: 'Hospital clinical departments and units',
      icon: 'IconBuildingHospital',
      color: 'turquoise',
      nameFieldLabel: 'Department Name',
      nameFieldDescription: 'Name of the hospital department',
    });

    const doctorObj = await ensureObject({
      nameSingular: 'doctor',
      namePlural: 'doctors',
      labelSingular: 'Doctor',
      labelPlural: 'Doctors',
      description: 'Medical doctors, specialists, and attending physicians',
      icon: 'IconUserCheck',
      color: 'purple',
      nameFieldLabel: 'Name',
      nameFieldDescription: 'Full name of the doctor',
    });

    const patientObj = await ensureObject({
      nameSingular: 'patient',
      namePlural: 'patients',
      labelSingular: 'Patient',
      labelPlural: 'Patients',
      description: 'Registered hospital patients and clinical care assignments',
      icon: 'IconHeartbeat',
      color: 'sky',
      nameFieldLabel: 'Patient Name',
      nameFieldDescription: 'Full name of the patient',
    });

    const appointmentObj = await ensureObject({
      nameSingular: 'appointment',
      namePlural: 'appointments',
      labelSingular: 'Appointment',
      labelPlural: 'Appointments',
      description: 'Scheduled patient consultations and clinical visits',
      icon: 'IconCalendarEvent',
      color: 'blue',
      nameFieldLabel: 'Appointment ID',
      nameFieldDescription: 'Unique auto-generated appointment code (e.g. APT-1001)',
    });

    const followUpObj = await ensureObject({
      nameSingular: 'followUp',
      namePlural: 'followUps',
      labelSingular: 'Follow-up',
      labelPlural: 'Follow-ups',
      description: 'Post-visit clinical follow-up tasks and patient outreach',
      icon: 'IconCalendarCheck',
      color: 'orange',
      nameFieldLabel: 'Task',
      nameFieldDescription: 'Follow-up task description',
    });

    const reportObj = await ensureObject({
      nameSingular: 'healthcareReport',
      namePlural: 'healthcareReports',
      labelSingular: 'Report',
      labelPlural: 'Reports',
      description: 'Live calculated Healthcare analytics summaries',
      icon: 'IconChartBar',
      color: 'green',
      nameFieldLabel: 'Report Name',
      nameFieldDescription: 'Analytics report title',
    });

    const memberObj = await getObjectByName('workspaceMember');

    // =========================================================================
    // STEP 2: CREATE ALL EXACT FIELDS & DATABASE-BACKED RELATIONSHIPS
    // =========================================================================
    console.log('\n[2/6] Queuing all Healthcare fields and database-backed relationships...');

    // --- 1. PATIENTS ---
    await ensureField(patientObj.id, 'patient', {
      name: 'patientCode',
      label: 'Patient ID',
      type: 'TEXT',
      icon: 'IconHash',
      description: 'Unique auto-generated Patient ID (e.g. PAT-1001)',
      isUnique: true,
    });
    await ensureField(patientObj.id, 'patient', {
      name: 'phone',
      label: 'Phone',
      type: 'PHONES',
      icon: 'IconPhone',
      description: 'Patient contact phone number',
    });
    await ensureField(patientObj.id, 'patient', {
      name: 'email',
      label: 'Email',
      type: 'EMAILS',
      icon: 'IconMail',
      description: 'Patient email address',
    });
    await ensureField(patientObj.id, 'patient', {
      name: 'dateOfBirth',
      label: 'Date of Birth',
      type: 'DATE',
      icon: 'IconCake',
      description: 'Patient date of birth (must not be in the future)',
    });
    await ensureField(patientObj.id, 'patient', {
      name: 'department',
      label: 'Department',
      type: 'RELATION',
      icon: 'IconBuildingHospital',
      description: 'Primary clinical department managing this patient',
      relationCreationPayload: {
        type: 'MANY_TO_ONE',
        targetObjectMetadataId: departmentObj.id,
        targetFieldLabel: 'Patients',
        targetFieldIcon: 'IconHeartbeat',
      },
    });
    await ensureField(patientObj.id, 'patient', {
      name: 'assignedDoctor',
      label: 'Assigned Doctor',
      type: 'RELATION',
      icon: 'IconUserCheck',
      description: 'Primary attending doctor assigned to this patient',
      relationCreationPayload: {
        type: 'MANY_TO_ONE',
        targetObjectMetadataId: doctorObj.id,
        targetFieldLabel: 'Assigned Patients',
        targetFieldIcon: 'IconHeartbeat',
      },
    });
    await ensureField(patientObj.id, 'patient', {
      name: 'status',
      label: 'Status',
      type: 'SELECT',
      icon: 'IconProgressCheck',
      description: 'Current patient care status',
      options: [
        { value: 'ACTIVE', label: 'Active', color: 'green', position: 0 },
        { value: 'ADMITTED', label: 'Admitted', color: 'orange', position: 1 },
        { value: 'DISCHARGED', label: 'Discharged', color: 'blue', position: 2 },
        { value: 'INACTIVE', label: 'Inactive', color: 'gray', position: 3 },
      ],
    });

    // --- 2. DOCTORS ---
    await ensureField(doctorObj.id, 'doctor', {
      name: 'doctorCode',
      label: 'Doctor ID',
      type: 'TEXT',
      icon: 'IconHash',
      description: 'Unique auto-generated Doctor ID (e.g. DOC-1001)',
      isUnique: true,
    });
    await ensureField(doctorObj.id, 'doctor', {
      name: 'specialization',
      label: 'Specialization',
      type: 'SELECT',
      icon: 'IconAward',
      description: 'Medical specialty',
      options: [
        { value: 'CARDIOLOGY', label: 'Cardiology', color: 'red', position: 0 },
        { value: 'NEUROLOGY', label: 'Neurology', color: 'purple', position: 1 },
        { value: 'ORTHOPEDICS', label: 'Orthopedics', color: 'blue', position: 2 },
        { value: 'PEDIATRICS', label: 'Pediatrics', color: 'sky', position: 3 },
        { value: 'INTERNAL_MEDICINE', label: 'Internal Medicine', color: 'turquoise', position: 4 },
        { value: 'DERMATOLOGY', label: 'Dermatology', color: 'pink', position: 5 },
        { value: 'SURGERY', label: 'General Surgery', color: 'orange', position: 6 },
        { value: 'EMERGENCY', label: 'Emergency Medicine', color: 'amber', position: 7 },
        { value: 'ONCOLOGY', label: 'Oncology', color: 'violet', position: 8 },
        { value: 'RADIOLOGY', label: 'Radiology', color: 'cyan', position: 9 },
      ],
    });
    await ensureField(doctorObj.id, 'doctor', {
      name: 'department',
      label: 'Department',
      type: 'RELATION',
      icon: 'IconBuildingHospital',
      description: 'Hospital department this doctor belongs to',
      relationCreationPayload: {
        type: 'MANY_TO_ONE',
        targetObjectMetadataId: departmentObj.id,
        targetFieldLabel: 'Doctors',
        targetFieldIcon: 'IconUserCheck',
      },
    });
    await ensureField(doctorObj.id, 'doctor', {
      name: 'contactInfo',
      label: 'Contact Information',
      type: 'TEXT',
      icon: 'IconAddressBook',
      description: 'Direct pager, extension, and clinical contact information',
    });
    await ensureField(doctorObj.id, 'doctor', {
      name: 'phone',
      label: 'Phone',
      type: 'PHONES',
      icon: 'IconPhone',
      description: 'Doctor phone number',
    });
    await ensureField(doctorObj.id, 'doctor', {
      name: 'email',
      label: 'Email',
      type: 'EMAILS',
      icon: 'IconMail',
      description: 'Doctor email address',
    });
    await ensureField(doctorObj.id, 'doctor', {
      name: 'availability',
      label: 'Availability',
      type: 'SELECT',
      icon: 'IconClock',
      description: 'Current duty and scheduling availability',
      options: [
        { value: 'AVAILABLE', label: 'Available', color: 'green', position: 0 },
        { value: 'IN_CONSULTATION', label: 'In Consultation', color: 'blue', position: 1 },
        { value: 'ON_LEAVE', label: 'On Leave', color: 'red', position: 2 },
        { value: 'OFF_DUTY', label: 'Off Duty', color: 'gray', position: 3 },
      ],
    });

    // --- 3. DEPARTMENTS ---
    await ensureField(departmentObj.id, 'department', {
      name: 'departmentHead',
      label: 'Department Head',
      type: 'RELATION',
      icon: 'IconUserCheck',
      description: 'Doctor serving as Head of Department',
      relationCreationPayload: {
        type: 'MANY_TO_ONE',
        targetObjectMetadataId: doctorObj.id,
        targetFieldLabel: 'Headed Departments',
        targetFieldIcon: 'IconBuildingHospital',
      },
    });
    await ensureField(departmentObj.id, 'department', {
      name: 'location',
      label: 'Location',
      type: 'TEXT',
      icon: 'IconMapPin',
      description: 'Hospital building, wing, and floor location',
    });
    await ensureField(departmentObj.id, 'department', {
      name: 'contactInfo',
      label: 'Contact Information',
      type: 'TEXT',
      icon: 'IconPhone',
      description: 'Department nurse station phone extension and email',
    });

    // --- 4. APPOINTMENTS ---
    await ensureField(appointmentObj.id, 'appointment', {
      name: 'patient',
      label: 'Patient',
      type: 'RELATION',
      icon: 'IconHeartbeat',
      description: 'Patient scheduled for this appointment',
      relationCreationPayload: {
        type: 'MANY_TO_ONE',
        targetObjectMetadataId: patientObj.id,
        targetFieldLabel: 'Appointments',
        targetFieldIcon: 'IconCalendarEvent',
      },
    });
    await ensureField(appointmentObj.id, 'appointment', {
      name: 'doctor',
      label: 'Doctor',
      type: 'RELATION',
      icon: 'IconUserCheck',
      description: 'Doctor conducting this appointment',
      relationCreationPayload: {
        type: 'MANY_TO_ONE',
        targetObjectMetadataId: doctorObj.id,
        targetFieldLabel: 'Appointments',
        targetFieldIcon: 'IconCalendarEvent',
      },
    });
    await ensureField(appointmentObj.id, 'appointment', {
      name: 'department',
      label: 'Department',
      type: 'RELATION',
      icon: 'IconBuildingHospital',
      description: 'Clinical department (auto-filled from Doctor if omitted)',
      relationCreationPayload: {
        type: 'MANY_TO_ONE',
        targetObjectMetadataId: departmentObj.id,
        targetFieldLabel: 'Appointments',
        targetFieldIcon: 'IconCalendarEvent',
      },
    });
    await ensureField(appointmentObj.id, 'appointment', {
      name: 'appointmentDate',
      label: 'Appointment Date',
      type: 'DATE',
      icon: 'IconCalendar',
      description: 'Scheduled date of appointment',
    });
    await ensureField(appointmentObj.id, 'appointment', {
      name: 'appointmentTime',
      label: 'Appointment Time',
      type: 'TEXT',
      icon: 'IconClock',
      description: 'Scheduled appointment time slot (e.g. 10:30 AM)',
    });
    await ensureField(appointmentObj.id, 'appointment', {
      name: 'reasonForVisit',
      label: 'Reason for Visit',
      type: 'TEXT',
      icon: 'IconNotes',
      description: 'Chief complaint or purpose of clinical visit',
    });
    await ensureField(appointmentObj.id, 'appointment', {
      name: 'status',
      label: 'Status',
      type: 'SELECT',
      icon: 'IconProgressCheck',
      description: 'Appointment scheduling and completion status',
      options: [
        { value: 'SCHEDULED', label: 'Scheduled', color: 'sky', position: 0 },
        { value: 'CONFIRMED', label: 'Confirmed', color: 'blue', position: 1 },
        { value: 'IN_PROGRESS', label: 'In Progress', color: 'yellow', position: 2 },
        { value: 'COMPLETED', label: 'Completed', color: 'green', position: 3 },
        { value: 'CANCELLED', label: 'Cancelled', color: 'red', position: 4 },
        { value: 'NO_SHOW', label: 'No-Show', color: 'orange', position: 5 },
      ],
    });

    // --- 5. FOLLOW-UPS ---
    await ensureField(followUpObj.id, 'followUp', {
      name: 'relatedPatient',
      label: 'Related Patient',
      type: 'RELATION',
      icon: 'IconHeartbeat',
      description: 'Patient associated with this follow-up task',
      relationCreationPayload: {
        type: 'MANY_TO_ONE',
        targetObjectMetadataId: patientObj.id,
        targetFieldLabel: 'Follow-ups',
        targetFieldIcon: 'IconCalendarCheck',
      },
    });
    await ensureField(followUpObj.id, 'followUp', {
      name: 'dueDate',
      label: 'Due Date',
      type: 'DATE',
      icon: 'IconCalendarDue',
      description: 'Target due date for completing this follow-up',
    });
    await ensureField(followUpObj.id, 'followUp', {
      name: 'assignedStaff',
      label: 'Assigned Staff',
      type: 'TEXT',
      icon: 'IconUsers',
      description: 'Nurse, care coordinator, or clinician responsible for follow-up',
    });
    await ensureField(followUpObj.id, 'followUp', {
      name: 'assignedDoctor',
      label: 'Assigned Doctor',
      type: 'RELATION',
      icon: 'IconUserCheck',
      description: 'Optional doctor supervising this follow-up',
      relationCreationPayload: {
        type: 'MANY_TO_ONE',
        targetObjectMetadataId: doctorObj.id,
        targetFieldLabel: 'Follow-ups',
        targetFieldIcon: 'IconCalendarCheck',
      },
    });
    if (memberObj) {
      await ensureField(followUpObj.id, 'followUp', {
        name: 'assignedUser',
        label: 'Assigned User',
        type: 'RELATION',
        icon: 'IconUser',
        description: 'Optional CRM staff member assigned to this follow-up',
        relationCreationPayload: {
          type: 'MANY_TO_ONE',
          targetObjectMetadataId: memberObj.id,
          targetFieldLabel: 'Assigned Follow-ups',
          targetFieldIcon: 'IconCalendarCheck',
        },
      });
    }
    await ensureField(followUpObj.id, 'followUp', {
      name: 'priority',
      label: 'Priority',
      type: 'SELECT',
      icon: 'IconFlag',
      description: 'Clinical urgency priority',
      options: [
        { value: 'LOW', label: 'Low', color: 'sky', position: 0 },
        { value: 'MEDIUM', label: 'Medium', color: 'blue', position: 1 },
        { value: 'HIGH', label: 'High', color: 'orange', position: 2 },
        { value: 'URGENT', label: 'Urgent', color: 'red', position: 3 },
      ],
    });
    await ensureField(followUpObj.id, 'followUp', {
      name: 'status',
      label: 'Status',
      type: 'SELECT',
      icon: 'IconProgressCheck',
      description: 'Current status of the follow-up task',
      options: [
        { value: 'PENDING', label: 'Pending', color: 'orange', position: 0 },
        { value: 'IN_PROGRESS', label: 'In Progress', color: 'blue', position: 1 },
        { value: 'COMPLETED', label: 'Completed', color: 'green', position: 2 },
        { value: 'OVERDUE', label: 'Overdue', color: 'red', position: 3 },
        { value: 'CANCELLED', label: 'Cancelled', color: 'gray', position: 4 },
      ],
    });

    // --- 6. REPORTS ---
    await ensureField(reportObj.id, 'healthcareReport', {
      name: 'reportCategory',
      label: 'Report Category',
      type: 'SELECT',
      icon: 'IconFolder',
      description: 'Analytics category (Patient Summary, Appointment Summary, Doctor Workload, Pending Follow-ups)',
      options: [
        { value: 'PATIENT_SUMMARY', label: 'Patient Summary', color: 'sky', position: 0 },
        { value: 'APPOINTMENT_SUMMARY', label: 'Appointment Summary', color: 'blue', position: 1 },
        { value: 'DOCTOR_WORKLOAD', label: 'Doctor Workload', color: 'purple', position: 2 },
        { value: 'PENDING_FOLLOW_UPS', label: 'Pending Follow-ups', color: 'orange', position: 3 },
      ],
    });
    await ensureField(reportObj.id, 'healthcareReport', {
      name: 'primaryMetric',
      label: 'Primary Metric',
      type: 'TEXT',
      icon: 'IconChartBar',
      description: 'Headline live calculated metric',
    });
    await ensureField(reportObj.id, 'healthcareReport', {
      name: 'summary',
      label: 'Summary',
      type: 'TEXT',
      icon: 'IconNotes',
      description: 'Executive summary of report metrics',
    });
    await ensureField(reportObj.id, 'healthcareReport', {
      name: 'details',
      label: 'Detailed Breakdown',
      type: 'TEXT',
      icon: 'IconFileDescription',
      description: 'Granular department/doctor/status breakdown',
    });
    await ensureField(reportObj.id, 'healthcareReport', {
      name: 'reportStatus',
      label: 'Status',
      type: 'SELECT',
      icon: 'IconActivity',
      description: 'Operational health indicator',
      options: [
        { value: 'HEALTHY', label: 'Healthy', color: 'green', position: 0 },
        { value: 'ACTIVE', label: 'Active', color: 'blue', position: 1 },
        { value: 'ATTENTION', label: 'Needs Attention', color: 'red', position: 2 },
      ],
    });
    await ensureField(reportObj.id, 'healthcareReport', {
      name: 'lastCalculatedAt',
      label: 'Last Calculated At',
      type: 'DATE_TIME',
      icon: 'IconClock',
      description: 'Timestamp when analytics metrics were last computed',
    });

    // Execute batched field & relation creations!
    await flushPendingFields();

    const appointmentStatusField = await getFieldByName(appointmentObj.id, 'status');
    const followUpStatusField = await getFieldByName(followUpObj.id, 'status');

    // =========================================================================
    // STEP 3: SEQUENCES, UNIQUE INDEXES, AUTO-FILL & VALIDATION TRIGGERS
    // =========================================================================
    console.log('\n[3/6] Installing safe PostgreSQL sequences, unique indexes & clinical validation triggers...');

    const tableMap = {};
    for (const nameSingular of ['department', 'doctor', 'patient', 'appointment', 'followUp', 'healthcareReport']) {
      const tblRes = await c.query(
        `SELECT table_name FROM information_schema.tables
         WHERE table_schema = $1 AND table_name IN ($2, $3) LIMIT 1`,
        [schema, `_${nameSingular}`, nameSingular],
      );
      if (tblRes.rows.length === 0) {
        throw new Error(`Workspace table for ${nameSingular} not found in schema ${schema}`);
      }
      tableMap[nameSingular] = tblRes.rows[0].table_name;
      console.log(`  [table] ${nameSingular} -> ${schema}."${tableMap[nameSingular]}"`);
    }

    const tDept = `"${tableMap.department}"`;
    const tDoc = `"${tableMap.doctor}"`;
    const tPat = `"${tableMap.patient}"`;
    const tApt = `"${tableMap.appointment}"`;
    const tFol = `"${tableMap.followUp}"`;
    const tRep = `"${tableMap.healthcareReport}"`;

    await c.query(`
      -- Sequences for auto-generated unique IDs
      CREATE SEQUENCE IF NOT EXISTS ${schema}.hc_pat_seq START WITH 1001;
      CREATE SEQUENCE IF NOT EXISTS ${schema}.hc_doc_seq START WITH 1001;
      CREATE SEQUENCE IF NOT EXISTS ${schema}.hc_apt_seq START WITH 1001;

      -- Unique partial indexes
      CREATE UNIQUE INDEX IF NOT EXISTS idx_hc_dept_name_uniq
        ON ${schema}.${tDept} (LOWER(name)) WHERE "deletedAt" IS NULL AND name IS NOT NULL AND name <> '';
      CREATE UNIQUE INDEX IF NOT EXISTS idx_hc_apt_id_uniq
        ON ${schema}.${tApt} (name) WHERE "deletedAt" IS NULL AND name IS NOT NULL AND name <> '';

      -- 1. Patients trigger: auto Patient ID, validate Date of Birth not in future, auto-inherit Department from Assigned Doctor
      CREATE OR REPLACE FUNCTION ${schema}.hc_patient_before_write()
      RETURNS TRIGGER AS $$
      DECLARE
        v_doc_dept_id uuid;
      BEGIN
        IF NEW."patientCode" IS NULL OR BTRIM(NEW."patientCode") = '' THEN
          NEW."patientCode" := 'PAT-' || nextval('${schema}.hc_pat_seq');
        END IF;

        IF NEW."dateOfBirth" IS NOT NULL AND NEW."dateOfBirth" > CURRENT_DATE THEN
          RAISE EXCEPTION 'Date of Birth cannot be in the future' USING ERRCODE = '23514';
        END IF;

        IF NEW."departmentId" IS NULL AND NEW."assignedDoctorId" IS NOT NULL THEN
          SELECT "departmentId" INTO v_doc_dept_id FROM ${schema}.${tDoc} WHERE id = NEW."assignedDoctorId";
          IF v_doc_dept_id IS NOT NULL THEN
            NEW."departmentId" := v_doc_dept_id;
          END IF;
        END IF;

        IF NEW.status IS NULL THEN
          NEW.status := 'ACTIVE';
        END IF;

        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;

      DROP TRIGGER IF EXISTS trg_hc_patient_before_write ON ${schema}.${tPat};
      CREATE TRIGGER trg_hc_patient_before_write
      BEFORE INSERT OR UPDATE ON ${schema}.${tPat}
      FOR EACH ROW EXECUTE FUNCTION ${schema}.hc_patient_before_write();

      -- 2. Doctors trigger: auto Doctor ID + default availability
      CREATE OR REPLACE FUNCTION ${schema}.hc_doctor_before_write()
      RETURNS TRIGGER AS $$
      BEGIN
        IF NEW."doctorCode" IS NULL OR BTRIM(NEW."doctorCode") = '' THEN
          NEW."doctorCode" := 'DOC-' || nextval('${schema}.hc_doc_seq');
        END IF;

        IF NEW.availability IS NULL THEN
          NEW.availability := 'AVAILABLE';
        END IF;

        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;

      DROP TRIGGER IF EXISTS trg_hc_doctor_before_write ON ${schema}.${tDoc};
      CREATE TRIGGER trg_hc_doctor_before_write
      BEFORE INSERT OR UPDATE ON ${schema}.${tDoc}
      FOR EACH ROW EXECUTE FUNCTION ${schema}.hc_doctor_before_write();

      -- 3. Appointments trigger: auto Appointment ID, block booking doctor ON_LEAVE, prevent doctor double-booking at same Date+Time, auto-inherit Department
      CREATE OR REPLACE FUNCTION ${schema}.hc_appointment_before_write()
      RETURNS TRIGGER AS $$
      DECLARE
        v_doc_avail text;
        v_doc_dept_id uuid;
        v_pat_dept_id uuid;
        v_conflict_count int;
      BEGIN
        IF NEW.name IS NULL OR BTRIM(NEW.name) = '' THEN
          NEW.name := 'APT-' || nextval('${schema}.hc_apt_seq');
        END IF;

        IF NEW.status IS NULL THEN
          NEW.status := 'SCHEDULED';
        END IF;

        IF NEW."doctorId" IS NOT NULL THEN
          SELECT availability::text, "departmentId"
          INTO v_doc_avail, v_doc_dept_id
          FROM ${schema}.${tDoc}
          WHERE id = NEW."doctorId";

          IF v_doc_avail = 'ON_LEAVE' AND NEW.status IN ('SCHEDULED', 'CONFIRMED', 'IN_PROGRESS') THEN
            RAISE EXCEPTION 'Selected Doctor is currently On Leave and cannot be booked for active appointments' USING ERRCODE = '23514';
          END IF;

          IF NEW."departmentId" IS NULL AND v_doc_dept_id IS NOT NULL THEN
            NEW."departmentId" := v_doc_dept_id;
          END IF;

          -- Prevent double-booking same doctor on same date & time for active appointments
          IF NEW."appointmentDate" IS NOT NULL AND NEW."appointmentTime" IS NOT NULL AND BTRIM(NEW."appointmentTime") <> ''
             AND NEW.status IN ('SCHEDULED', 'CONFIRMED', 'IN_PROGRESS') THEN
            SELECT COUNT(*)::int INTO v_conflict_count
            FROM ${schema}.${tApt}
            WHERE "doctorId" = NEW."doctorId"
              AND "appointmentDate" = NEW."appointmentDate"
              AND LOWER(BTRIM("appointmentTime")) = LOWER(BTRIM(NEW."appointmentTime"))
              AND status IN ('SCHEDULED', 'CONFIRMED', 'IN_PROGRESS')
              AND "deletedAt" IS NULL
              AND id <> NEW.id;

            IF v_conflict_count > 0 THEN
              RAISE EXCEPTION 'Doctor already has an appointment booked at % on %', NEW."appointmentTime", NEW."appointmentDate" USING ERRCODE = '23514';
            END IF;
          END IF;
        END IF;

        IF NEW."departmentId" IS NULL AND NEW."patientId" IS NOT NULL THEN
          SELECT "departmentId" INTO v_pat_dept_id FROM ${schema}.${tPat} WHERE id = NEW."patientId";
          IF v_pat_dept_id IS NOT NULL THEN
            NEW."departmentId" := v_pat_dept_id;
          END IF;
        END IF;

        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;

      DROP TRIGGER IF EXISTS trg_hc_appointment_before_write ON ${schema}.${tApt};
      CREATE TRIGGER trg_hc_appointment_before_write
      BEFORE INSERT OR UPDATE ON ${schema}.${tApt}
      FOR EACH ROW EXECUTE FUNCTION ${schema}.hc_appointment_before_write();

      -- 4. Follow-ups trigger: defaults + non-empty task validation
      CREATE OR REPLACE FUNCTION ${schema}.hc_followup_before_write()
      RETURNS TRIGGER AS $$
      BEGIN
        IF NEW.name IS NULL OR BTRIM(NEW.name) = '' THEN
          RAISE EXCEPTION 'Follow-up Task description is required' USING ERRCODE = '23514';
        END IF;

        IF NEW.priority IS NULL THEN
          NEW.priority := 'MEDIUM';
        END IF;

        IF NEW.status IS NULL THEN
          NEW.status := 'PENDING';
        END IF;

        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;

      DROP TRIGGER IF EXISTS trg_hc_followup_before_write ON ${schema}.${tFol};
      CREATE TRIGGER trg_hc_followup_before_write
      BEFORE INSERT OR UPDATE ON ${schema}.${tFol}
      FOR EACH ROW EXECUTE FUNCTION ${schema}.hc_followup_before_write();

      -- 5. Reports trigger: auto-timestamp lastCalculatedAt
      CREATE OR REPLACE FUNCTION ${schema}.hc_report_before_write()
      RETURNS TRIGGER AS $$
      BEGIN
        NEW."lastCalculatedAt" := NOW();
        IF NEW."reportStatus" IS NULL THEN
          NEW."reportStatus" := 'ACTIVE';
        END IF;
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;

      DROP TRIGGER IF EXISTS trg_hc_report_before_write ON ${schema}.${tRep};
      CREATE TRIGGER trg_hc_report_before_write
      BEFORE INSERT OR UPDATE ON ${schema}.${tRep}
      FOR EACH ROW EXECUTE FUNCTION ${schema}.hc_report_before_write();
    `);

    console.log('  [ok] Installed Healthcare sequences, unique indexes, and validation triggers.');

    // =========================================================================
    // STEP 4: KANBAN PIPELINES & TABLE VIEW COLUMN ORDERING
    // =========================================================================
    console.log('\n[4/6] Configuring Healthcare Kanban pipelines and Table views...');

    const appRes = await c.query(`SELECT id FROM core.application WHERE "workspaceId" = $1 AND name = 'Custom' LIMIT 1`, [wsId]);
    const customAppId = appRes.rows[0]?.id || (await c.query(`SELECT id FROM core.application WHERE "workspaceId" = $1 LIMIT 1`, [wsId])).rows[0]?.id;

    const ensureKanbanView = async (objId, viewName, icon, groupFieldId, cardFields) => {
      if (!groupFieldId) return;
      const ex = await c.query(
        `SELECT id FROM core.view WHERE "workspaceId" = $1 AND "objectMetadataId" = $2 AND type = 'KANBAN' AND name = $3`,
        [wsId, objId, viewName],
      );
      let viewId;
      if (ex.rows.length === 0) {
        await viewService.createOne({
          workspaceId: wsId,
          createViewInput: {
            name: viewName,
            objectMetadataId: objId,
            type: 'KANBAN',
            icon,
            position: 1,
            visibility: 'WORKSPACE',
            mainGroupByFieldMetadataId: groupFieldId,
          },
        });
        const vLookup = await c.query(
          `SELECT id FROM core.view WHERE "workspaceId" = $1 AND "objectMetadataId" = $2 AND type = 'KANBAN' AND name = $3 LIMIT 1`,
          [wsId, objId, viewName],
        );
        viewId = vLookup.rows[0]?.id;
        console.log(`  [ok] Created Kanban view "${viewName}"`);
      } else {
        viewId = ex.rows[0].id;
      }

      if (viewId && cardFields?.length) {
        const fRes = await c.query(`SELECT id, name FROM core."fieldMetadata" WHERE "workspaceId" = $1 AND "objectMetadataId" = $2`, [wsId, objId]);
        const fMap = {};
        fRes.rows.forEach((r) => { fMap[r.name] = r.id; });
        await c.query(`DELETE FROM core."viewField" WHERE "viewId" = $1`, [viewId]);
        for (let i = 0; i < cardFields.length; i++) {
          const fId = fMap[cardFields[i]];
          if (fId) {
            await c.query(
              `INSERT INTO core."viewField" (id, "universalIdentifier", "viewId", "fieldMetadataId", position, "isVisible", "isActive", size, "workspaceId", "applicationId", "createdAt", "updatedAt")
               VALUES (gen_random_uuid(), gen_random_uuid(), $1, $2, $3, true, true, 160, $4, $5, NOW(), NOW())`,
              [viewId, fId, i, wsId, customAppId],
            );
          }
        }
      }
    };

    await ensureKanbanView(appointmentObj.id, 'Appointment Pipeline', 'IconCalendarEvent', appointmentStatusField?.id, [
      'name', 'patient', 'doctor', 'department', 'appointmentDate', 'appointmentTime',
    ]);
    await ensureKanbanView(followUpObj.id, 'Follow-up Board', 'IconCalendarCheck', followUpStatusField?.id, [
      'name', 'relatedPatient', 'dueDate', 'assignedStaff', 'priority',
    ]);

    const moduleTableColumns = [
      {
        objId: patientObj.id,
        viewName: 'All Patients',
        fields: ['patientCode', 'name', 'phone', 'email', 'dateOfBirth', 'department', 'assignedDoctor', 'status'],
      },
      {
        objId: appointmentObj.id,
        viewName: 'All Appointments',
        fields: ['name', 'patient', 'doctor', 'department', 'appointmentDate', 'appointmentTime', 'reasonForVisit', 'status'],
      },
      {
        objId: doctorObj.id,
        viewName: 'All Doctors',
        fields: ['doctorCode', 'name', 'specialization', 'department', 'contactInfo', 'phone', 'email', 'availability'],
      },
      {
        objId: departmentObj.id,
        viewName: 'All Departments',
        fields: ['name', 'departmentHead', 'location', 'contactInfo'],
      },
      {
        objId: followUpObj.id,
        viewName: 'All Follow-ups',
        fields: ['name', 'relatedPatient', 'dueDate', 'assignedStaff', 'assignedDoctor', 'priority', 'status'],
      },
      {
        objId: reportObj.id,
        viewName: 'All Reports',
        fields: ['name', 'reportCategory', 'primaryMetric', 'summary', 'reportStatus', 'lastCalculatedAt', 'details'],
      },
    ];

    for (const cfg of moduleTableColumns) {
      const fRes = await c.query(
        `SELECT id, name FROM core."fieldMetadata" WHERE "workspaceId" = $1 AND "objectMetadataId" = $2`,
        [wsId, cfg.objId],
      );
      const fMap = {};
      fRes.rows.forEach((r) => { fMap[r.name] = r.id; });

      const vRes = await c.query(
        `SELECT id FROM core.view WHERE "workspaceId" = $1 AND "objectMetadataId" = $2 AND type = 'TABLE' ORDER BY position ASC LIMIT 1`,
        [wsId, cfg.objId],
      );
      if (vRes.rows.length > 0) {
        const viewId = vRes.rows[0].id;
        await c.query(`UPDATE core.view SET name = $1, "updatedAt" = NOW() WHERE id = $2`, [cfg.viewName, viewId]);
        await c.query(`DELETE FROM core."viewField" WHERE "viewId" = $1`, [viewId]);
        for (let i = 0; i < cfg.fields.length; i++) {
          const fId = fMap[cfg.fields[i]];
          if (fId) {
            await c.query(
              `INSERT INTO core."viewField" (
                 id, "universalIdentifier", "viewId", "fieldMetadataId", position, "isVisible", "isActive", size, "workspaceId", "applicationId", "createdAt", "updatedAt"
               ) VALUES (
                 gen_random_uuid(), gen_random_uuid(), $1, $2, $3, true, true, $4, $5, $6, NOW(), NOW()
               )`,
              [viewId, fId, i, i === 0 || i === 1 ? 180 : 150, wsId, customAppId],
            );
          }
        }
      }
    }

    // =========================================================================
    // STEP 5: SIDEBAR NAVIGATION (6 HEALTHCARE MODULES + PRESERVE WORKFLOWS!)
    // =========================================================================
    console.log('\n[5/6] Organizing Healthcare sidebar navigation (preserving Workflows)...');

    const hcNavItems = [
      { objId: patientObj.id, name: 'Patients', icon: 'IconHeartbeat', color: 'sky' },
      { objId: appointmentObj.id, name: 'Appointments', icon: 'IconCalendarEvent', color: 'blue' },
      { objId: doctorObj.id, name: 'Doctors', icon: 'IconUserCheck', color: 'purple' },
      { objId: departmentObj.id, name: 'Departments', icon: 'IconBuildingHospital', color: 'turquoise' },
      { objId: followUpObj.id, name: 'Follow-ups', icon: 'IconCalendarCheck', color: 'orange' },
      { objId: reportObj.id, name: 'Reports', icon: 'IconChartBar', color: 'green' },
    ];

    if (isOnboardingTemplate) {
      for (let i = 0; i < hcNavItems.length; i++) {
        const item = hcNavItems[i];
        const ex = await c.query(
          `SELECT id FROM core."navigationMenuItem" WHERE "workspaceId" = $1 AND "targetObjectMetadataId" = $2 LIMIT 1`,
          [wsId, item.objId],
        );
        if (ex.rows.length > 0) {
          await c.query(
            `UPDATE core."navigationMenuItem" SET name = $1, icon = $2, color = $3, position = $4, "folderId" = NULL, "updatedAt" = NOW() WHERE id = $5`,
            [item.name, item.icon, item.color, i, ex.rows[0].id],
          );
        } else {
          await c.query(
            `INSERT INTO core."navigationMenuItem" (
               id, "universalIdentifier", name, icon, color, position, type, "targetObjectMetadataId", "workspaceId", "applicationId", "createdAt", "updatedAt"
             ) VALUES (
               gen_random_uuid(), gen_random_uuid(), $1, $2, $3, $4, 'OBJECT', $5, $6, $7, NOW(), NOW()
             )`,
            [item.name, item.icon, item.color, i, item.objId, wsId, customAppId],
          );
        }
      }

      // Ensure Workflows objects are active and Workflows folder is preserved at position 6
      await c.query(
        `UPDATE core."objectMetadata" SET "isActive" = true WHERE "workspaceId" = $1 AND "nameSingular" IN ('workflow', 'workflowRun', 'workflowVersion')`,
        [wsId],
      );
      const exWfFolder = await c.query(
        `SELECT id FROM core."navigationMenuItem" WHERE "workspaceId" = $1 AND type = 'FOLDER' AND name = 'Workflows'`,
        [wsId],
      );
      if (exWfFolder.rows.length > 0) {
        await c.query(`UPDATE core."navigationMenuItem" SET position = 6, "updatedAt" = NOW() WHERE id = $1`, [exWfFolder.rows[0].id]);
      } else {
        const wfIns = await c.query(
          `INSERT INTO core."navigationMenuItem" (
             id, "universalIdentifier", name, icon, color, position, type, "workspaceId", "applicationId", "createdAt", "updatedAt"
           ) VALUES (
             gen_random_uuid(), gen_random_uuid(), 'Workflows', 'IconSettingsAutomation', 'orange', 6, 'FOLDER', $1, $2, NOW(), NOW()
           ) RETURNING id`,
          [wsId, customAppId],
        );
        const wfFolderId = wfIns.rows[0].id;
        const wfObjs = await c.query(
          `SELECT id, "nameSingular" FROM core."objectMetadata" WHERE "workspaceId" = $1 AND "nameSingular" IN ('workflow', 'workflowRun', 'workflowVersion')`,
          [wsId],
        );
        const wfOrder = { workflow: 0, workflowRun: 1, workflowVersion: 2 };
        for (const wo of wfObjs.rows) {
          await c.query(
            `INSERT INTO core."navigationMenuItem" (
               id, "universalIdentifier", position, type, "folderId", "targetObjectMetadataId", "workspaceId", "applicationId", "createdAt", "updatedAt"
             ) VALUES (
               gen_random_uuid(), gen_random_uuid(), $1, 'OBJECT', $2, $3, $4, $5, NOW(), NOW()
             )`,
            [wfOrder[wo.nameSingular] ?? 0, wfFolderId, wo.id, wsId, customAppId],
          );
        }
      }

      // Remove stock CRM nav links from sidebar (without deleting data or Workflows!)
      const stockHidden = await c.query(
        `SELECT id FROM core."objectMetadata" WHERE "workspaceId" = $1 AND "nameSingular" IN ('company', 'person', 'opportunity', 'task', 'note', 'dashboard', 'workspaceMember')`,
        [wsId],
      );
      for (const row of stockHidden.rows) {
        await c.query(
          `DELETE FROM core."navigationMenuItem" WHERE "workspaceId" = $1 AND "targetObjectMetadataId" = $2`,
          [wsId, row.id],
        );
      }
    }

    // =========================================================================
    // STEP 6: SEED INTERCONNECTED HEALTHCARE DUMMY DATA + LIVE CALCULATED REPORTS
    // =========================================================================
    console.log('\n[6/6] Seeding interconnected Healthcare CRM sample data and computing live reports...');

    const SYS_COLS = '"createdByName", "updatedByName", "createdBySource", "updatedBySource"';
    const SYS_VALS = "'System', 'System', 'MANUAL', 'MANUAL'";

    // 1. Departments (6)
    const sampleDepts = [
      { id: 'aa111111-0001-4000-8000-000000000001', name: 'Cardiology', loc: 'Building A, Floor 3, East Wing', contact: 'Ext. 3100 | cardiology@metrohealth.org' },
      { id: 'aa111111-0002-4000-8000-000000000002', name: 'Neurology', loc: 'Building A, Floor 4, North Wing', contact: 'Ext. 4200 | neurology@metrohealth.org' },
      { id: 'aa111111-0003-4000-8000-000000000003', name: 'Orthopedics', loc: 'Building B, Floor 2, Surgical Block', contact: 'Ext. 2300 | ortho@metrohealth.org' },
      { id: 'aa111111-0004-4000-8000-000000000004', name: 'Pediatrics', loc: 'Building C, Floor 1, Family Pavilion', contact: 'Ext. 1400 | pediatrics@metrohealth.org' },
      { id: 'aa111111-0005-4000-8000-000000000005', name: 'Internal Medicine', loc: 'Building A, Floor 2, Central Wing', contact: 'Ext. 2100 | internalmed@metrohealth.org' },
      { id: 'aa111111-0006-4000-8000-000000000006', name: 'Emergency & Trauma', loc: 'Building A, Ground Floor, ER Entrance', contact: 'Ext. 9110 | emergency@metrohealth.org' },
    ];
    for (let i = 0; i < sampleDepts.length; i++) {
      const d = sampleDepts[i];
      await c.query(
        `INSERT INTO ${schema}.${tDept} (id, name, location, "contactInfo", position, ${SYS_COLS})
         VALUES ($1, $2, $3, $4, $5, ${SYS_VALS})
         ON CONFLICT (id) DO NOTHING`,
        [d.id, d.name, d.loc, d.contact, i],
      );
    }

    // 2. Doctors (6)
    const sampleDocs = [
      { id: 'bb222222-0001-4000-8000-000000000001', code: 'DOC-1001', name: 'Dr. Priya Ramanathan', spec: 'CARDIOLOGY', deptId: sampleDepts[0].id, info: 'Pager #4401 • Room 304B', phone: '9840211001', cc: 'IN', call: '+91', email: 'dr.priya@metrohealth.org', avail: 'AVAILABLE' },
      { id: 'bb222222-0002-4000-8000-000000000002', code: 'DOC-1002', name: 'Dr. Marcus Vance', spec: 'NEUROLOGY', deptId: sampleDepts[1].id, info: 'Pager #4402 • Room 412A', phone: '4155551002', cc: 'US', call: '+1', email: 'dr.vance@metrohealth.org', avail: 'AVAILABLE' },
      { id: 'bb222222-0003-4000-8000-000000000003', code: 'DOC-1003', name: 'Dr. Arjun Menon', spec: 'ORTHOPEDICS', deptId: sampleDepts[2].id, info: 'Pager #4403 • Room 218C', phone: '9840211003', cc: 'IN', call: '+91', email: 'dr.arjun@metrohealth.org', avail: 'IN_CONSULTATION' },
      { id: 'bb222222-0004-4000-8000-000000000004', code: 'DOC-1004', name: 'Dr. Elena Rostova', spec: 'PEDIATRICS', deptId: sampleDepts[3].id, info: 'Pager #4404 • Room 105P', phone: '4155551004', cc: 'US', call: '+1', email: 'dr.elena@metrohealth.org', avail: 'AVAILABLE' },
      { id: 'bb222222-0005-4000-8000-000000000005', code: 'DOC-1005', name: 'Dr. Karthik Subramanian', spec: 'INTERNAL_MEDICINE', deptId: sampleDepts[4].id, info: 'Pager #4405 • Room 208A', phone: '9840211005', cc: 'IN', call: '+91', email: 'dr.karthik@metrohealth.org', avail: 'AVAILABLE' },
      { id: 'bb222222-0006-4000-8000-000000000006', code: 'DOC-1006', name: 'Dr. Sarah Jenkins', spec: 'EMERGENCY', deptId: sampleDepts[5].id, info: 'Pager #4406 • ER Trauma Desk', phone: '4155551006', cc: 'US', call: '+1', email: 'dr.sarah@metrohealth.org', avail: 'ON_LEAVE' },
    ];
    for (let i = 0; i < sampleDocs.length; i++) {
      const d = sampleDocs[i];
      await c.query(
        `INSERT INTO ${schema}.${tDoc} (
           id, "doctorCode", name, specialization, "departmentId", "contactInfo",
           "phonePrimaryPhoneNumber", "phonePrimaryPhoneCountryCode", "phonePrimaryPhoneCallingCode",
           "emailPrimaryEmail", availability, position, ${SYS_COLS}
         ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, ${SYS_VALS})
         ON CONFLICT (id) DO NOTHING`,
        [d.id, d.code, d.name, d.spec, d.deptId, d.info, d.phone, d.cc, d.call, d.email, d.avail, i],
      );
    }

    // Link each Department's Department Head -> its lead Doctor!
    for (let i = 0; i < sampleDepts.length; i++) {
      await c.query(
        `UPDATE ${schema}.${tDept} SET "departmentHeadId" = $1 WHERE id = $2 AND "departmentHeadId" IS NULL`,
        [sampleDocs[i].id, sampleDepts[i].id],
      );
    }

    // 3. Patients (8)
    const samplePatients = [
      { id: 'cc333333-0001-4000-8000-000000000001', code: 'PAT-1001', name: 'Ananya Krishnan', phone: '9840500001', cc: 'IN', call: '+91', email: 'ananya.k@gmail.com', dob: '1988-04-14', deptId: sampleDepts[0].id, docId: sampleDocs[0].id, status: 'ACTIVE' },
      { id: 'cc333333-0002-4000-8000-000000000002', code: 'PAT-1002', name: 'David Miller', phone: '4155552002', cc: 'US', call: '+1', email: 'david.miller@outlook.com', dob: '1974-09-22', deptId: sampleDepts[0].id, docId: sampleDocs[0].id, status: 'ADMITTED' },
      { id: 'cc333333-0003-4000-8000-000000000003', code: 'PAT-1003', name: 'Meera Sundaram', phone: '9840500003', cc: 'IN', call: '+91', email: 'meera.s@gmail.com', dob: '1992-11-08', deptId: sampleDepts[1].id, docId: sampleDocs[1].id, status: 'ACTIVE' },
      { id: 'cc333333-0004-4000-8000-000000000004', code: 'PAT-1004', name: 'Rohan Verma', phone: '9840500004', cc: 'IN', call: '+91', email: 'rohan.verma@yahoo.com', dob: '1981-02-19', deptId: sampleDepts[2].id, docId: sampleDocs[2].id, status: 'ADMITTED' },
      { id: 'cc333333-0005-4000-8000-000000000005', code: 'PAT-1005', name: 'Chloe Thompson', phone: '4155552005', cc: 'US', call: '+1', email: 'parent.thompson@gmail.com', dob: '2018-06-30', deptId: sampleDepts[3].id, docId: sampleDocs[3].id, status: 'ACTIVE' },
      { id: 'cc333333-0006-4000-8000-000000000006', code: 'PAT-1006', name: 'Vikramaditya Rao', phone: '9840500006', cc: 'IN', call: '+91', email: 'vikram.rao@gmail.com', dob: '1965-12-03', deptId: sampleDepts[4].id, docId: sampleDocs[4].id, status: 'ACTIVE' },
      { id: 'cc333333-0007-4000-8000-000000000007', code: 'PAT-1007', name: 'Sophia Martinez', phone: '4155552007', cc: 'US', call: '+1', email: 'sophia.m@gmail.com', dob: '1995-07-17', deptId: sampleDepts[1].id, docId: sampleDocs[1].id, status: 'DISCHARGED' },
      { id: 'cc333333-0008-4000-8000-000000000008', code: 'PAT-1008', name: 'Lakshmi Narayanan', phone: '9840500008', cc: 'IN', call: '+91', email: 'lakshmi.n@gmail.com', dob: '1959-01-25', deptId: sampleDepts[4].id, docId: sampleDocs[4].id, status: 'ACTIVE' },
    ];
    for (let i = 0; i < samplePatients.length; i++) {
      const p = samplePatients[i];
      await c.query(
        `INSERT INTO ${schema}.${tPat} (
           id, "patientCode", name,
           "phonePrimaryPhoneNumber", "phonePrimaryPhoneCountryCode", "phonePrimaryPhoneCallingCode",
           "emailPrimaryEmail", "dateOfBirth", "departmentId", "assignedDoctorId", status, position, ${SYS_COLS}
         ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8::date, $9, $10, $11, $12, ${SYS_VALS})
         ON CONFLICT (id) DO NOTHING`,
        [p.id, p.code, p.name, p.phone, p.cc, p.call, p.email, p.dob, p.deptId, p.docId, p.status, i],
      );
    }

    // 4. Appointments (8 - across SCHEDULED, CONFIRMED, IN_PROGRESS, COMPLETED, CANCELLED)
    const sampleApts = [
      { id: 'dd444444-0001-4000-8000-000000000001', name: 'APT-1001', patId: samplePatients[0].id, docId: sampleDocs[0].id, deptId: sampleDepts[0].id, date: '2026-11-19', time: '09:30 AM', reason: 'Annual Echocardiogram & ECG review', status: 'CONFIRMED' },
      { id: 'dd444444-0002-4000-8000-000000000002', name: 'APT-1002', patId: samplePatients[1].id, docId: sampleDocs[0].id, deptId: sampleDepts[0].id, date: '2026-11-19', time: '11:00 AM', reason: 'Post-angioplasty inpatient cardiology round', status: 'IN_PROGRESS' },
      { id: 'dd444444-0003-4000-8000-000000000003', name: 'APT-1003', patId: samplePatients[2].id, docId: sampleDocs[1].id, deptId: sampleDepts[1].id, date: '2026-11-20', time: '10:00 AM', reason: 'Chronic migraine MRI brain evaluation', status: 'SCHEDULED' },
      { id: 'dd444444-0004-4000-8000-000000000004', name: 'APT-1004', patId: samplePatients[3].id, docId: sampleDocs[2].id, deptId: sampleDepts[2].id, date: '2026-11-18', time: '02:00 PM', reason: 'ACL knee reconstruction post-op mobility check', status: 'COMPLETED' },
      { id: 'dd444444-0005-4000-8000-000000000005', name: 'APT-1005', patId: samplePatients[4].id, docId: sampleDocs[3].id, deptId: sampleDepts[3].id, date: '2026-11-21', time: '03:30 PM', reason: 'Pediatric immunization booster & growth check', status: 'CONFIRMED' },
      { id: 'dd444444-0006-4000-8000-000000000006', name: 'APT-1006', patId: samplePatients[5].id, docId: sampleDocs[4].id, deptId: sampleDepts[4].id, date: '2026-11-19', time: '04:00 PM', reason: 'HbA1c quarterly diabetes & hypertension review', status: 'SCHEDULED' },
      { id: 'dd444444-0007-4000-8000-000000000007', name: 'APT-1007', patId: samplePatients[6].id, docId: sampleDocs[1].id, deptId: sampleDepts[1].id, date: '2026-11-15', time: '01:00 PM', reason: 'Post-concussion clearance assessment', status: 'COMPLETED' },
      { id: 'dd444444-0008-4000-8000-000000000008', name: 'APT-1008', patId: samplePatients[7].id, docId: sampleDocs[4].id, deptId: sampleDepts[4].id, date: '2026-11-22', time: '10:30 AM', reason: 'Lipid panel review (rescheduled by patient)', status: 'CANCELLED' },
    ];
    for (let i = 0; i < sampleApts.length; i++) {
      const a = sampleApts[i];
      await c.query(
        `INSERT INTO ${schema}.${tApt} (
           id, name, "patientId", "doctorId", "departmentId",
           "appointmentDate", "appointmentTime", "reasonForVisit", status, position, ${SYS_COLS}
         ) VALUES ($1, $2, $3, $4, $5, $6::date, $7, $8, $9, $10, ${SYS_VALS})
         ON CONFLICT (id) DO NOTHING`,
        [a.id, a.name, a.patId, a.docId, a.deptId, a.date, a.time, a.reason, a.status, i],
      );
    }

    // 5. Follow-ups (8)
    const sampleFollowUps = [
      { id: 'ee555555-0001-4000-8000-000000000001', task: 'Call patient to confirm fasting blood draw before ECG', patId: samplePatients[0].id, due: '2026-11-19', staff: 'Nurse Kavya S.', docId: sampleDocs[0].id, prio: 'HIGH', status: 'PENDING' },
      { id: 'ee555555-0002-4000-8000-000000000002', task: 'Review 48-hour post-angioplasty telemetry & vitals chart', patId: samplePatients[1].id, due: '2026-11-19', staff: 'Nurse Deepa R.', docId: sampleDocs[0].id, prio: 'URGENT', status: 'IN_PROGRESS' },
      { id: 'ee555555-0003-4000-8000-000000000003', task: 'Upload Radiology MRI DICOM scans prior to Neuro consult', patId: samplePatients[2].id, due: '2026-11-20', staff: 'Care Coord. Sanjay M.', docId: sampleDocs[1].id, prio: 'MEDIUM', status: 'PENDING' },
      { id: 'ee555555-0004-4000-8000-000000000004', task: 'Schedule Week-2 orthopedic physiotherapy sessions', patId: samplePatients[3].id, due: '2026-11-21', staff: 'PT Divya K.', docId: sampleDocs[2].id, prio: 'HIGH', status: 'PENDING' },
      { id: 'ee555555-0005-4000-8000-000000000005', task: 'Send vaccination digital certificate to parent email', patId: samplePatients[4].id, due: '2026-11-22', staff: 'Nurse Maria L.', docId: sampleDocs[3].id, prio: 'LOW', status: 'PENDING' },
      { id: 'ee555555-0006-4000-8000-000000000006', task: 'Verify updated insulin dosage adherence via tele-call', patId: samplePatients[5].id, due: '2026-11-17', staff: 'Nurse Kavya S.', docId: sampleDocs[4].id, prio: 'HIGH', status: 'OVERDUE' },
      { id: 'ee555555-0007-4000-8000-000000000007', task: 'Post-discharge recovery check-in call (completed)', patId: samplePatients[6].id, due: '2026-11-16', staff: 'Care Coord. Sanjay M.', docId: sampleDocs[1].id, prio: 'MEDIUM', status: 'COMPLETED' },
      { id: 'ee555555-0008-4000-8000-000000000008', task: 'Reschedule cancelled lipid panel lab appointment', patId: samplePatients[7].id, due: '2026-11-20', staff: 'Front Desk Anita P.', docId: sampleDocs[4].id, prio: 'MEDIUM', status: 'PENDING' },
    ];
    for (let i = 0; i < sampleFollowUps.length; i++) {
      const f = sampleFollowUps[i];
      await c.query(
        `INSERT INTO ${schema}.${tFol} (
           id, name, "relatedPatientId", "dueDate", "assignedStaff", "assignedDoctorId", priority, status, position, ${SYS_COLS}
         ) VALUES ($1, $2, $3, $4::date, $5, $6, $7, $8, $9, ${SYS_VALS})
         ON CONFLICT (id) DO NOTHING`,
        [f.id, f.task, f.patId, f.due, f.staff, f.docId, f.prio, f.status, i],
      );
    }

    // 6. Dynamically Calculate & Upsert the 4 Requested Healthcare Reports!
    const patStats = (await c.query(`
      SELECT COUNT(*)::int AS total,
             COUNT(*) FILTER (WHERE status = 'ACTIVE')::int AS active,
             COUNT(*) FILTER (WHERE status = 'ADMITTED')::int AS admitted,
             COUNT(*) FILTER (WHERE status = 'DISCHARGED')::int AS discharged
      FROM ${schema}.${tPat} WHERE "deletedAt" IS NULL
    `)).rows[0];

    const aptStats = (await c.query(`
      SELECT COUNT(*)::int AS total,
             COUNT(*) FILTER (WHERE status IN ('SCHEDULED','CONFIRMED'))::int AS upcoming,
             COUNT(*) FILTER (WHERE status = 'IN_PROGRESS')::int AS in_prog,
             COUNT(*) FILTER (WHERE status = 'COMPLETED')::int AS completed,
             COUNT(*) FILTER (WHERE status IN ('CANCELLED','NO_SHOW'))::int AS cancelled
      FROM ${schema}.${tApt} WHERE "deletedAt" IS NULL
    `)).rows[0];

    const docWorkloadRows = (await c.query(`
      SELECT d.name, d.availability::text AS avail,
             (SELECT COUNT(*)::int FROM ${schema}.${tPat} p WHERE p."assignedDoctorId" = d.id AND p."deletedAt" IS NULL) AS patients,
             (SELECT COUNT(*)::int FROM ${schema}.${tApt} a WHERE a."doctorId" = d.id AND a."deletedAt" IS NULL) AS appointments
      FROM ${schema}.${tDoc} d WHERE d."deletedAt" IS NULL ORDER BY appointments DESC, d.name
    `)).rows;

    const folStats = (await c.query(`
      SELECT COUNT(*)::int AS total,
             COUNT(*) FILTER (WHERE status IN ('PENDING','IN_PROGRESS'))::int AS pending,
             COUNT(*) FILTER (WHERE status = 'OVERDUE')::int AS overdue,
             COUNT(*) FILTER (WHERE status = 'COMPLETED')::int AS completed,
             COUNT(*) FILTER (WHERE priority IN ('HIGH','URGENT') AND status <> 'COMPLETED')::int AS urgent_open
      FROM ${schema}.${tFol} WHERE "deletedAt" IS NULL
    `)).rows[0];

    const docBreakdown = docWorkloadRows
      .map((r) => `- ${r.name} (${r.avail}): ${r.patients} patients, ${r.appointments} appointments`)
      .join('\n');

    const reports = [
      {
        id: 'ff666666-0001-4000-8000-000000000001',
        name: 'Patient Summary',
        cat: 'PATIENT_SUMMARY',
        metric: `${patStats.total} Total (${patStats.active} Active, ${patStats.admitted} Admitted)`,
        summary: `${patStats.active} outpatient active, ${patStats.admitted} currently admitted, and ${patStats.discharged} discharged across 6 clinical departments.`,
        details: `Live Patient Breakdown:\n- Active Outpatients: ${patStats.active}\n- Admitted Inpatients: ${patStats.admitted}\n- Discharged: ${patStats.discharged}\n- Total Registered: ${patStats.total}`,
        status: 'HEALTHY',
      },
      {
        id: 'ff666666-0002-4000-8000-000000000002',
        name: 'Appointment Summary',
        cat: 'APPOINTMENT_SUMMARY',
        metric: `${aptStats.upcoming} Upcoming / ${aptStats.completed} Completed`,
        summary: `${aptStats.total} total appointments: ${aptStats.upcoming} scheduled/confirmed, ${aptStats.in_prog} in progress, ${aptStats.completed} completed, ${aptStats.cancelled} cancelled/no-show.`,
        details: `Live Appointment Breakdown:\n- Scheduled & Confirmed: ${aptStats.upcoming}\n- Currently In Progress: ${aptStats.in_prog}\n- Completed Visits: ${aptStats.completed}\n- Cancelled / No-Show: ${aptStats.cancelled}`,
        status: 'ACTIVE',
      },
      {
        id: 'ff666666-0003-4000-8000-000000000003',
        name: 'Doctor Workload',
        cat: 'DOCTOR_WORKLOAD',
        metric: `${docWorkloadRows.length} Doctors Active Across 6 Depts`,
        summary: `Live physician caseload and appointment allocation across Cardiology, Neurology, Orthopedics, Pediatrics, Internal Medicine, and Emergency.`,
        details: `Doctor Caseload Breakdown:\n${docBreakdown}`,
        status: 'HEALTHY',
      },
      {
        id: 'ff666666-0004-4000-8000-000000000004',
        name: 'Pending Follow-ups',
        cat: 'PENDING_FOLLOW_UPS',
        metric: `${folStats.pending} Pending / ${folStats.overdue} Overdue`,
        summary: `${folStats.urgent_open} high/urgent priority clinical follow-ups require attention; ${folStats.completed} follow-ups completed.`,
        details: `Live Follow-up Queue:\n- Pending & In Progress: ${folStats.pending}\n- Overdue Tasks: ${folStats.overdue}\n- Open High/Urgent Priority: ${folStats.urgent_open}\n- Completed: ${folStats.completed}`,
        status: folStats.overdue > 0 ? 'ATTENTION' : 'HEALTHY',
      },
    ];

    for (let i = 0; i < reports.length; i++) {
      const r = reports[i];
      await c.query(
        `INSERT INTO ${schema}.${tRep} (
           id, name, "reportCategory", "primaryMetric", summary, details, "reportStatus", position, ${SYS_COLS}
         ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, ${SYS_VALS})
         ON CONFLICT (id) DO UPDATE SET
           "primaryMetric" = EXCLUDED."primaryMetric",
           summary = EXCLUDED.summary,
           details = EXCLUDED.details,
           "reportStatus" = EXCLUDED."reportStatus",
           "updatedAt" = NOW()`,
        [r.id, r.name, r.cat, r.metric, r.summary, r.details, r.status, i],
      );
    }

    // Advance auto-ID sequences past seeded numbers
    await c.query(`
      SELECT setval('${schema}.hc_pat_seq', GREATEST(1010, (SELECT last_value FROM ${schema}.hc_pat_seq)));
      SELECT setval('${schema}.hc_doc_seq', GREATEST(1010, (SELECT last_value FROM ${schema}.hc_doc_seq)));
      SELECT setval('${schema}.hc_apt_seq', GREATEST(1010, (SELECT last_value FROM ${schema}.hc_apt_seq)));
    `);

    // Update WORKSPACE_INDUSTRY_CONFIG
    await c.query(`DELETE FROM core."keyValuePair" WHERE "workspaceId" = $1 AND key = 'WORKSPACE_INDUSTRY_CONFIG'`, [wsId]);
    await c.query(
      `INSERT INTO core."keyValuePair" (id, "workspaceId", key, value, type, "createdAt", "updatedAt")
       VALUES (gen_random_uuid(), $1, 'WORKSPACE_INDUSTRY_CONFIG', $2::jsonb, 'USER_VARIABLE', NOW(), NOW())`,
      [wsId, JSON.stringify({ industry: 'healthcare', updatedAt: new Date().toISOString() })],
    );

    // Bump metadataVersion + ensure workspace is ACTIVE and un-deleted + flush Redis + evict server local cache
    await c.query(`
      UPDATE core.workspace 
      SET "metadataVersion" = "metadataVersion" + 1,
          "activationStatus" = 'ACTIVE',
          "deletedAt" = NULL
      WHERE id = $1
    `, [wsId]);
    await c.query(`UPDATE core."userWorkspace" SET "deletedAt" = NULL WHERE "workspaceId" = $1`, [wsId]);

    try {
      const r = createClient({ url: process.env.REDIS_URL || 'redis://redis:6379' });
      await r.connect();
      await r.flushAll();
      await r.disconnect();
    } catch (redisErr) {
      console.warn('  [warn] Redis flush:', redisErr.message);
    }

    if (workspaceCacheService) {
      await workspaceCacheService.evictWorkspaceFromLocalCache(wsId);
    }

    console.log('=========================================================================');
    console.log(`HEALTHCARE CRM PROVISIONING COMPLETE FOR WORKSPACE ${wsId}!`);
    console.log('=========================================================================');

    return {
      workspaceId: wsId,
      schema,
      objects: {
        patient: patientObj.id,
        appointment: appointmentObj.id,
        doctor: doctorObj.id,
        department: departmentObj.id,
        followUp: followUpObj.id,
        healthcareReport: reportObj.id,
      },
      tables: tableMap,
    };
  } finally {
    await c.end();
  }
}

module.exports = { provisionHealthcareModules };
