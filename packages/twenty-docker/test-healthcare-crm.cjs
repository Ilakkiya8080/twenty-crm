const { Client } = require('pg');
const assert = require('assert');

const PG_URL = process.env.PG_DATABASE_URL || 'postgres://postgres:postgres@db:5432/default';
const INTERNAL_SERVER_URL = 'http://localhost:3000';

async function runTests() {
  const c = new Client({ connectionString: PG_URL });
  await c.connect();

  let passed = 0;
  let failed = 0;

  const test = async (name, fn) => {
    try {
      await fn();
      console.log(`  PASS: ${name}`);
      passed++;
    } catch (err) {
      console.error(`  FAIL: ${name} -> ${err.message}`);
      failed++;
    }
  };

  const ws = (
    await c.query(`SELECT id, "displayName", "databaseSchema" FROM core.workspace WHERE "deletedAt" IS NULL ORDER BY "createdAt" DESC LIMIT 1`)
  ).rows[0];
  assert(ws, 'Active workspace must exist');
  const wsId = ws.id;
  const schema = ws.databaseSchema;
  console.log(`\nRunning Healthcare CRM Integration Tests on workspace "${ws.displayName}" (${wsId}) [${schema}]\n`);

  const tableMap = {};
  for (const objName of ['patient', 'appointment', 'doctor', 'department', 'followUp', 'healthcareReport']) {
    const tRes = await c.query(
      `SELECT table_name FROM information_schema.tables WHERE table_schema = $1 AND table_name IN ($2, $3) LIMIT 1`,
      [schema, `_${objName}`, objName],
    );
    assert(tRes.rows.length === 1, `Table for ${objName} must exist in ${schema}`);
    tableMap[objName] = `"${tRes.rows[0].table_name}"`;
  }

  await test('All 6 Healthcare custom objects exist in core.objectMetadata and are active & editable', async () => {
    const res = await c.query(
      `SELECT "nameSingular", "isActive", "isUICreatable", "isUIEditable"
       FROM core."objectMetadata"
       WHERE "workspaceId" = $1 AND "nameSingular" = ANY($2)`,
      [wsId, ['patient', 'appointment', 'doctor', 'department', 'followUp', 'healthcareReport']],
    );
    assert.strictEqual(res.rows.length, 6, `Expected 6 Healthcare objects, found ${res.rows.length}`);
    for (const r of res.rows) {
      assert.strictEqual(r.isActive, true);
      assert.strictEqual(r.isUICreatable, true);
    }
  });

  await test('Sidebar navigation contains all 6 Healthcare modules + Workflows preserved', async () => {
    const navs = await c.query(`SELECT name FROM core."navigationMenuItem" WHERE "workspaceId" = $1`, [wsId]);
    const names = new Set(navs.rows.map((r) => r.name));
    for (const expected of ['Patients', 'Appointments', 'Doctors', 'Departments', 'Follow-ups', 'Reports', 'Workflows']) {
      assert(names.has(expected), `Missing sidebar item: ${expected}`);
    }
  });

  await test('All required Healthcare database-backed relationships exist in core.fieldMetadata', async () => {
    const rels = await c.query(
      `SELECT om."nameSingular" as src, fm.name as field, tom."nameSingular" as target
       FROM core."fieldMetadata" fm
       JOIN core."objectMetadata" om ON om.id = fm."objectMetadataId"
       JOIN core."objectMetadata" tom ON tom.id = fm."relationTargetObjectMetadataId"
       WHERE fm."workspaceId" = $1 AND fm.type = 'RELATION'
         AND om."nameSingular" = ANY($2)`,
      [wsId, ['patient', 'appointment', 'doctor', 'department', 'followUp']],
    );
    const pairs = new Set(rels.rows.map((r) => `${r.src}.${r.field}->${r.target}`));
    for (const req of [
      'patient.department->department',
      'patient.assignedDoctor->doctor',
      'doctor.department->department',
      'department.departmentHead->doctor',
      'appointment.patient->patient',
      'appointment.doctor->doctor',
      'appointment.department->department',
      'followUp.relatedPatient->patient',
      'followUp.assignedDoctor->doctor',
    ]) {
      assert(pairs.has(req), `Missing relation ${req}`);
    }
  });

  await test('Kanban views exist for Appointments (Appointment Pipeline) and Follow-ups (Follow-up Board)', async () => {
    const kv = await c.query(
      `SELECT om."nameSingular", v.name, count(vf.id)::int as cols
       FROM core.view v
       JOIN core."objectMetadata" om ON om.id = v."objectMetadataId"
       LEFT JOIN core."viewField" vf ON vf."viewId" = v.id
       WHERE v."workspaceId" = $1 AND v.type = 'KANBAN' AND om."nameSingular" IN ('appointment', 'followUp')
       GROUP BY om."nameSingular", v.name`,
      [wsId],
    );
    assert.strictEqual(kv.rows.length, 2, 'Expected 2 Kanban views');
    for (const r of kv.rows) {
      assert(r.cols >= 5, `Kanban ${r.name} must have card fields`);
    }
  });

  await test('Seeded dummy records & all 4 live calculated Reports exist', async () => {
    const counts = {};
    for (const k of Object.keys(tableMap)) {
      counts[k] = (await c.query(`SELECT count(*)::int as cnt FROM ${schema}.${tableMap[k]}`)).rows[0].cnt;
    }
    assert(counts.department >= 6, 'Expected >= 6 departments');
    assert(counts.doctor >= 6, 'Expected >= 6 doctors');
    assert(counts.patient >= 8, 'Expected >= 8 patients');
    assert(counts.appointment >= 8, 'Expected >= 8 appointments');
    assert(counts.followUp >= 8, 'Expected >= 8 follow-ups');
    assert(counts.healthcareReport >= 4, 'Expected 4 Healthcare reports');

    const repNames = (await c.query(`SELECT name FROM ${schema}.${tableMap.healthcareReport}`)).rows.map((r) => r.name);
    for (const req of ['Patient Summary', 'Appointment Summary', 'Doctor Workload', 'Pending Follow-ups']) {
      assert(repNames.includes(req), `Missing report: ${req}`);
    }
  });

  const created = { fol: [], apt: [], pat: [], doc: [] };
  const SYS_COLS = `"createdByName", "updatedByName", "createdBySource", "updatedBySource"`;
  const SYS_VALS = `'System', 'System', 'MANUAL', 'MANUAL'`;

  try {
    const deptId = (await c.query(`SELECT id FROM ${schema}.${tableMap.department} LIMIT 1`)).rows[0].id;
    const availDocId = (await c.query(`SELECT id FROM ${schema}.${tableMap.doctor} WHERE availability = 'AVAILABLE' LIMIT 1`)).rows[0].id;
    const leaveDocId = (await c.query(`SELECT id FROM ${schema}.${tableMap.doctor} WHERE availability = 'ON_LEAVE' LIMIT 1`)).rows[0].id;

    let testPatId;

    await test('Patients: auto Patient ID, auto-inherit Department from Doctor, & reject future Date of Birth', async () => {
      const p = await c.query(
        `INSERT INTO ${schema}.${tableMap.patient} (name, "dateOfBirth", "assignedDoctorId", ${SYS_COLS})
         VALUES ('Test Patient Validation', '1990-05-15', $1, ${SYS_VALS})
         RETURNING id, "patientCode", "departmentId", status`,
        [availDocId],
      );
      testPatId = p.rows[0].id;
      created.pat.push(testPatId);
      assert(p.rows[0].patientCode.startsWith('PAT-'), 'patientCode should auto-generate');
      assert(p.rows[0].departmentId, 'departmentId should auto-inherit from assignedDoctor');
      assert.strictEqual(p.rows[0].status, 'ACTIVE');

      let futureRejected = false;
      try {
        await c.query(
          `INSERT INTO ${schema}.${tableMap.patient} (name, "dateOfBirth", ${SYS_COLS})
           VALUES ('Future Baby', '2099-01-01', ${SYS_VALS})`,
        );
      } catch (e) {
        futureRejected = e.code === '23514' && e.message.includes('future');
      }
      assert(futureRejected, 'Future Date of Birth must be rejected');
    });

    await test('Appointments: auto Appointment ID, reject On-Leave Doctor, & prevent double-booking same Doctor/Date/Time', async () => {
      // 1. Valid booking (omit departmentId -> auto-inherits from doctor!)
      const a1 = await c.query(
        `INSERT INTO ${schema}.${tableMap.appointment} ("patientId", "doctorId", "appointmentDate", "appointmentTime", "reasonForVisit", ${SYS_COLS})
         VALUES ($1, $2, '2026-12-29', '03:00 PM', 'Test checkup', ${SYS_VALS})
         RETURNING id, name, "departmentId", status`,
        [testPatId, availDocId],
      );
      created.apt.push(a1.rows[0].id);
      assert(a1.rows[0].name.startsWith('APT-'), 'Appointment ID should auto-generate');
      assert(a1.rows[0].departmentId, 'Appointment department should auto-inherit from Doctor');
      assert.strictEqual(a1.rows[0].status, 'SCHEDULED');

      // 2. Double-booking same Doctor + Date + Time -> MUST FAIL!
      let doubleBookRejected = false;
      try {
        await c.query(
          `INSERT INTO ${schema}.${tableMap.appointment} ("patientId", "doctorId", "appointmentDate", "appointmentTime", ${SYS_COLS})
           VALUES ($1, $2, '2026-12-29', '03:00 PM', ${SYS_VALS})`,
          [testPatId, availDocId],
        );
      } catch (e) {
        doubleBookRejected = e.code === '23514' && e.message.includes('already has an appointment');
      }
      assert(doubleBookRejected, 'Double-booking same doctor at same date/time must be rejected');

      // 3. Booking doctor who is ON_LEAVE -> MUST FAIL!
      let onLeaveRejected = false;
      try {
        await c.query(
          `INSERT INTO ${schema}.${tableMap.appointment} ("patientId", "doctorId", "appointmentDate", "appointmentTime", ${SYS_COLS})
           VALUES ($1, $2, '2026-12-30', '10:00 AM', ${SYS_VALS})`,
          [testPatId, leaveDocId],
        );
      } catch (e) {
        onLeaveRejected = e.code === '23514' && e.message.includes('On Leave');
      }
      assert(onLeaveRejected, 'Booking a doctor who is On Leave must be rejected');
    });

    await test('Follow-ups: defaults (MEDIUM/PENDING) & non-empty Task validation', async () => {
      const f = await c.query(
        `INSERT INTO ${schema}.${tableMap.followUp} (name, "relatedPatientId", "dueDate", "assignedStaff", ${SYS_COLS})
         VALUES ('Test lab result call', $1, '2026-12-30', 'Nurse Test', ${SYS_VALS})
         RETURNING id, priority, status`,
        [testPatId],
      );
      created.fol.push(f.rows[0].id);
      assert.strictEqual(f.rows[0].priority, 'MEDIUM');
      assert.strictEqual(f.rows[0].status, 'PENDING');

      let emptyRejected = false;
      try {
        await c.query(
          `INSERT INTO ${schema}.${tableMap.followUp} (name, "relatedPatientId", ${SYS_COLS}) VALUES ('   ', $1, ${SYS_VALS})`,
          [testPatId],
        );
      } catch (e) {
        emptyRejected = e.code === '23514';
      }
      assert(emptyRejected, 'Blank Follow-up Task must be rejected');
    });

    await test('Twenty server /healthz returns 200', async () => {
      const res = await fetch(`${INTERNAL_SERVER_URL}/healthz`);
      assert.strictEqual(res.status, 200);
    });
  } finally {
    for (const id of created.fol) await c.query(`DELETE FROM ${schema}.${tableMap.followUp} WHERE id = $1`, [id]);
    for (const id of created.apt) await c.query(`DELETE FROM ${schema}.${tableMap.appointment} WHERE id = $1`, [id]);
    for (const id of created.pat) await c.query(`DELETE FROM ${schema}.${tableMap.patient} WHERE id = $1`, [id]);
    for (const id of created.doc) await c.query(`DELETE FROM ${schema}.${tableMap.doctor} WHERE id = $1`, [id]);
    await c.end();
  }

  console.log(`\n=========================================================================`);
  console.log(`HEALTHCARE TEST SUMMARY: ${passed} passed, ${failed} failed`);
  console.log(`=========================================================================\n`);
  if (failed > 0) process.exit(1);
}

runTests().catch((err) => {
  console.error('Fatal Healthcare test error:', err);
  process.exit(1);
});
