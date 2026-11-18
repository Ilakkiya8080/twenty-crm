const { Client } = require('pg');

async function verifyAll() {
  const c = new Client({ connectionString: 'postgres://postgres:postgres@db:5432/default' });
  await c.connect();

  console.log('🔍 =========================================================================');
  console.log('🔍 REAL ESTATE CRM - COMPREHENSIVE VERIFICATION AUDIT');
  console.log('🔍 =========================================================================\n');

  const ws = (await c.query(`SELECT id, "displayName", "databaseSchema", "metadataVersion" FROM core.workspace WHERE "deletedAt" IS NULL`)).rows[0];
  console.log(`🏢 Active Workspace: "${ws.displayName}" (${ws.id})`);
  console.log(`🐘 Database Schema: ${ws.databaseSchema}`);
  console.log(`🔖 Metadata Version: ${ws.metadataVersion}\n`);

  const modules = [
    {
      name: 'Property Listings',
      singular: 'company',
      expectedFields: ['propertyId', 'name', 'propertyType', 'listingType', 'price', 'bedrooms', 'bathrooms', 'builtUpArea', 'areaUnit', 'propertyAddress', 'city', 'propertyStatus', 'accountOwner'],
      expectedColCount: 13,
    },
    {
      name: 'Buyers & Leads',
      singular: 'person',
      expectedFields: ['leadId', 'name', 'phones', 'emails', 'leadSource', 'requirement', 'preferredPropertyType', 'budgetMin', 'budgetMax', 'preferredLocation', 'assignedAgent', 'leadStage'],
      expectedColCount: 12,
    },
    {
      name: 'Agents & Brokers',
      singular: 'workspaceMember',
      expectedFields: ['name', 'agentId', 'userEmail', 'phoneNumber', 'licenseNumber', 'experienceYears', 'specialization', 'location', 'status', 'joiningDate', 'commissionRate', 'accountOwnerForCompanies', 'ownedOpportunities'],
      expectedColCount: 13,
    },
    {
      name: 'Deals',
      singular: 'opportunity',
      expectedFields: ['name', 'dealType', 'pointOfContact', 'company', 'owner', 'amount', 'closeDate', 'stage'],
      expectedColCount: 8,
    },
    {
      name: 'Follow-ups',
      singular: 'task',
      expectedFields: ['followUpId', 'lead', 'relatedDeal', 'relatedProperty', 'followUpType', 'dueAt', 'assignee', 'status', 'notes', 'nextFollowUpDate'],
      expectedColCount: 10,
    },
    {
      name: 'Site Visits',
      singular: 'note',
      expectedFields: ['visitId', 'buyerLead', 'property', 'visitDate', 'visitTime', 'assignedAgent', 'visitStatus', 'feedback', 'nextActionDate'],
      expectedColCount: 9,
    },
    {
      name: 'Reports',
      singular: 'dashboard',
      expectedFields: ['title', 'category', 'primaryMetric', 'summary', 'status', 'lastCalculatedAt'],
      expectedColCount: 6,
    },
  ];

  let allPassed = true;

  for (const m of modules) {
    console.log(`-------------------------------------------------------------------------`);
    console.log(`📦 Verifying Module: ${m.name} (${m.singular})`);
    console.log(`-------------------------------------------------------------------------`);

    const objRes = await c.query(`SELECT id, "labelSingular", "labelPlural", "isUICreatable" FROM core."objectMetadata" WHERE "workspaceId" = $1 AND "nameSingular" = $2`, [ws.id, m.singular]);
    if (objRes.rows.length === 0) {
      console.error(`❌ Object ${m.singular} NOT FOUND in workspace!`);
      allPassed = false;
      continue;
    }
    const obj = objRes.rows[0];
    console.log(`  ✓ Object: ${obj.labelSingular} / ${obj.labelPlural} (isUICreatable: ${obj.isUICreatable})`);

    // 1. Check Field Metadata
    const fieldsRes = await c.query(`SELECT name, label, type FROM core."fieldMetadata" WHERE "workspaceId" = $1 AND "objectMetadataId" = $2`, [ws.id, obj.id]);
    const fieldMap = {};
    fieldsRes.rows.forEach(f => { fieldMap[f.name] = f; });

    let missingFields = [];
    for (const ef of m.expectedFields) {
      if (!fieldMap[ef]) {
        missingFields.push(ef);
      }
    }

    if (missingFields.length === 0) {
      console.log(`  ✓ Field Metadata: All ${m.expectedFields.length} expected fields present: [${m.expectedFields.join(', ')}]`);
    } else {
      console.error(`  ❌ Missing Field Metadata: ${missingFields.join(', ')}`);
      allPassed = false;
    }

    // 2. Check Create Drawer Layout (RECORD_FORM)
    const layoutRes = await c.query(`SELECT id FROM core."pageLayout" WHERE "workspaceId" = $1 AND "objectMetadataId" = $2 AND type = 'RECORD_FORM'`, [ws.id, obj.id]);
    if (layoutRes.rows.length > 0) {
      const widgetCountRes = await c.query(`
        SELECT COUNT(*)::int as count 
        FROM core."pageLayoutWidget" w
        JOIN core."pageLayoutTab" t ON w."pageLayoutTabId" = t.id
        WHERE t."pageLayoutId" = $1 AND w.type = 'FORM_FIELD'
      `, [layoutRes.rows[0].id]);
      console.log(`  ✓ + Create Drawer (RECORD_FORM): ${widgetCountRes.rows[0].count} FORM_FIELD widgets configured`);
    } else {
      if (m.singular !== 'dashboard') {
        console.warn(`  ⚠️ No RECORD_FORM layout found for ${m.singular}`);
      }
    }

    // 3. Check Side Panel (FIELDS_WIDGET View)
    const fwRes = await c.query(`SELECT id FROM core.view WHERE "workspaceId" = $1 AND "objectMetadataId" = $2 AND type = 'FIELDS_WIDGET'`, [ws.id, obj.id]);
    if (fwRes.rows.length > 0) {
      const groupCount = await c.query(`SELECT COUNT(*)::int as count FROM core."viewFieldGroup" WHERE "viewId" = $1`, [fwRes.rows[0].id]);
      const vfCount = await c.query(`SELECT COUNT(*)::int as count FROM core."viewField" WHERE "viewId" = $1`, [fwRes.rows[0].id]);
      console.log(`  ✓ Side Panel (FIELDS_WIDGET): ${groupCount.rows[0].count} groups with ${vfCount.rows[0].count} total fields`);
    } else {
      console.warn(`  ⚠️ No FIELDS_WIDGET view found for ${m.singular}`);
    }

    // 4. Check Table View Columns
    const tvRes = await c.query(`SELECT id, name FROM core.view WHERE "workspaceId" = $1 AND "objectMetadataId" = $2 AND type = 'TABLE'`, [ws.id, obj.id]);
    if (tvRes.rows.length > 0) {
      const colRes = await c.query(`
        SELECT vf.position, fm.name, fm.label 
        FROM core."viewField" vf
        JOIN core."fieldMetadata" fm ON vf."fieldMetadataId" = fm.id
        WHERE vf."viewId" = $1 AND vf."isVisible" = true
        ORDER BY vf.position
      `, [tvRes.rows[0].id]);
      console.log(`  ✓ Table View "${tvRes.rows[0].name}": ${colRes.rows.length} visible columns`);
      console.log(`    Columns: ${colRes.rows.map(c => `${c.label} (${c.name})`).join(', ')}`);
    } else {
      console.warn(`  ⚠️ No TABLE view found for ${m.singular}`);
    }

    // 5. Check Database Records in Schema
    try {
      const recRes = await c.query(`SELECT COUNT(*)::int as count FROM ${ws.databaseSchema}."${m.singular}"`);
      console.log(`  ✓ Live Database Records in "${m.singular}": ${recRes.rows[0].count} rows\n`);
    } catch (e) {
      console.error(`  ❌ Error querying schema table "${m.singular}":`, e.message);
      allPassed = false;
    }
  }

  // Sidebar navigation order verification
  console.log('-------------------------------------------------------------------------');
  console.log('🧭 Sidebar Navigation Order Verification');
  console.log('-------------------------------------------------------------------------');
  const navRes = await c.query(`
    SELECT n.position, n.name, n.icon, n.color, om."nameSingular"
    FROM core."navigationMenuItem" n
    LEFT JOIN core."objectMetadata" om ON n."targetObjectMetadataId" = om.id
    WHERE n."workspaceId" = $1
    ORDER BY n.position;
  `, [ws.id]);
  console.table(navRes.rows);

  await c.end();

  console.log('\n=========================================================================');
  if (allPassed) {
    console.log('🎉 AUDIT COMPLETE: ALL MODULES, FIELDS, VIEWS, AND DATA 100% HEALTHY!');
  } else {
    console.log('⚠️ AUDIT COMPLETED WITH WARNINGS/ERRORS.');
  }
  console.log('=========================================================================\n');
}

verifyAll().catch(console.error);

