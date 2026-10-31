const { Client } = require('pg');

async function provisionReportsModule() {
  const c = new Client({
    connectionString: process.env.PG_DATABASE_URL || 'postgres://postgres:postgres@db:5432/default',
  });
  await c.connect();

  const wsId = '32c2a902-9983-4e13-b6f6-bc96609f8238';
  const schema = 'workspace_306npwj88jcxnl7zwdogk8bw8';

  console.log('🚀 Starting Reports & Analytics Module Provisioning for Real Estate CRM...');

  // 1. Applications
  const stdAppRes = await c.query(`SELECT id FROM core.application WHERE "workspaceId" = $1 AND name = 'Standard' LIMIT 1`, [wsId]);
  const customAppRes = await c.query(`SELECT id FROM core.application WHERE "workspaceId" = $1 AND name = 'Custom' LIMIT 1`, [wsId]);
  const stdAppId = stdAppRes.rows.length > 0 ? stdAppRes.rows[0].id : null;
  const customAppId = customAppRes.rows.length > 0 ? customAppRes.rows[0].id : stdAppId;

  // 2. Object Metadata for dashboard
  const dashObj = (await c.query(`SELECT id FROM core."objectMetadata" WHERE "workspaceId" = $1 AND "nameSingular" = 'dashboard'`, [wsId])).rows[0];
  const dashObjId = dashObj.id;
  console.log('  ✓ Dashboard (Reports) Object ID:', dashObjId);

  // 3. PostgreSQL Enums and Columns on schema.dashboard
  console.log('\n📦 Setting up PostgreSQL Enums and Columns on dashboard...');
  await c.query(`
    DO $$ BEGIN
      CREATE TYPE ${schema}."dashboard_category_enum" AS ENUM ('PROPERTIES', 'LEADS', 'SITE_VISITS', 'DEALS', 'AGENTS', 'FOLLOW_UPS');
    EXCEPTION WHEN duplicate_object THEN null;
    END $$;

    DO $$ BEGIN
      CREATE TYPE ${schema}."dashboard_status_enum" AS ENUM ('HEALTHY', 'ACTIVE', 'ATTENTION');
    EXCEPTION WHEN duplicate_object THEN null;
    END $$;

    ALTER TABLE ${schema}.dashboard
      ADD COLUMN IF NOT EXISTS "category" ${schema}."dashboard_category_enum" DEFAULT 'PROPERTIES',
      ADD COLUMN IF NOT EXISTS "primaryMetric" text,
      ADD COLUMN IF NOT EXISTS "summary" text,
      ADD COLUMN IF NOT EXISTS "details" text,
      ADD COLUMN IF NOT EXISTS "status" ${schema}."dashboard_status_enum" DEFAULT 'HEALTHY',
      ADD COLUMN IF NOT EXISTS "lastCalculatedAt" timestamp with time zone DEFAULT NOW();
  `);
  console.log('  ✓ Table columns and types ready');

  // 4. Update and Add Fields in core."fieldMetadata"
  console.log('\n📝 Configuring Field Metadata on dashboard...');

  // 4.1 title -> Report Name
  await c.query(`
    UPDATE core."fieldMetadata"
    SET label = 'Report Name', icon = 'IconFileReport', description = 'Name or metric title of the analytics report', "updatedAt" = NOW()
    WHERE "workspaceId" = $1 AND "objectMetadataId" = $2 AND name = 'title'
  `, [wsId, dashObjId]);
  const titleFieldId = (await c.query(`SELECT id FROM core."fieldMetadata" WHERE "workspaceId" = $1 AND "objectMetadataId" = $2 AND name = 'title'`, [wsId, dashObjId])).rows[0].id;
  console.log('  ✓ title (Report Name) Field ID:', titleFieldId);

  // 4.2 category (SELECT)
  const categoryOptions = [
    { id: '90909090-0001-4000-8000-000000000001', color: 'turquoise', label: 'Property Listings', value: 'PROPERTIES', position: 0 },
    { id: '90909090-0002-4000-8000-000000000002', color: 'blue', label: 'Buyers & Leads', value: 'LEADS', position: 1 },
    { id: '90909090-0003-4000-8000-000000000003', color: 'sky', label: 'Site Visits', value: 'SITE_VISITS', position: 2 },
    { id: '90909090-0004-4000-8000-000000000004', color: 'green', label: 'Deals & Revenue', value: 'DEALS', position: 3 },
    { id: '90909090-0005-4000-8000-000000000005', color: 'purple', label: 'Agents & Performance', value: 'AGENTS', position: 4 },
    { id: '90909090-0006-4000-8000-000000000006', color: 'orange', label: 'Follow-ups', value: 'FOLLOW_UPS', position: 5 },
  ];

  let catFieldRes = await c.query(`SELECT id FROM core."fieldMetadata" WHERE "workspaceId" = $1 AND "objectMetadataId" = $2 AND name = 'category'`, [wsId, dashObjId]);
  let categoryFieldId;
  if (catFieldRes.rows.length === 0) {
    const ins = await c.query(`
      INSERT INTO core."fieldMetadata" (
        id, "universalIdentifier", "objectMetadataId", "workspaceId", "applicationId",
        name, label, type, icon, description, options, "defaultValue", settings,
        "isActive", "isSystem", "isUIEditable", "isUIReadOnly", "isNullable", "isLabelSyncedWithName", "createdAt", "updatedAt"
      ) VALUES (
        gen_random_uuid(), gen_random_uuid(), $1, $2, $3,
        'category', 'Category', 'SELECT', 'IconFolder', 'Module or business category of the report',
        $4, $5, null,
        true, false, true, false, false, false, NOW(), NOW()
      ) RETURNING id;
    `, [dashObjId, wsId, customAppId, JSON.stringify(categoryOptions), JSON.stringify("'PROPERTIES'")]);
    categoryFieldId = ins.rows[0].id;
  } else {
    categoryFieldId = catFieldRes.rows[0].id;
    await c.query(`
      UPDATE core."fieldMetadata"
      SET label = 'Category', icon = 'IconFolder', options = $1, "defaultValue" = $2, "updatedAt" = NOW()
      WHERE id = $3
    `, [JSON.stringify(categoryOptions), JSON.stringify("'PROPERTIES'"), categoryFieldId]);
  }
  console.log('  ✓ category Field ID:', categoryFieldId);

  // 4.3 primaryMetric (TEXT)
  let metricFieldRes = await c.query(`SELECT id FROM core."fieldMetadata" WHERE "workspaceId" = $1 AND "objectMetadataId" = $2 AND name = 'primaryMetric'`, [wsId, dashObjId]);
  let metricFieldId;
  if (metricFieldRes.rows.length === 0) {
    const ins = await c.query(`
      INSERT INTO core."fieldMetadata" (
        id, "universalIdentifier", "objectMetadataId", "workspaceId", "applicationId",
        name, label, type, icon, description, settings, "isActive", "isSystem",
        "isUIEditable", "isUIReadOnly", "isNullable", "isLabelSyncedWithName", "createdAt", "updatedAt"
      ) VALUES (
        gen_random_uuid(), gen_random_uuid(), $1, $2, $3,
        'primaryMetric', 'Primary Metric / KPI', 'TEXT', 'IconTrendingUp', 'Primary calculated key performance indicator for this report',
        null, true, false,
        true, false, true, false, NOW(), NOW()
      ) RETURNING id;
    `, [dashObjId, wsId, customAppId]);
    metricFieldId = ins.rows[0].id;
  } else {
    metricFieldId = metricFieldRes.rows[0].id;
    await c.query(`UPDATE core."fieldMetadata" SET label = 'Primary Metric / KPI', icon = 'IconTrendingUp', "updatedAt" = NOW() WHERE id = $1`, [metricFieldId]);
  }
  console.log('  ✓ primaryMetric Field ID:', metricFieldId);

  // 4.4 summary (TEXT)
  let summaryFieldRes = await c.query(`SELECT id FROM core."fieldMetadata" WHERE "workspaceId" = $1 AND "objectMetadataId" = $2 AND name = 'summary'`, [wsId, dashObjId]);
  let summaryFieldId;
  if (summaryFieldRes.rows.length === 0) {
    const ins = await c.query(`
      INSERT INTO core."fieldMetadata" (
        id, "universalIdentifier", "objectMetadataId", "workspaceId", "applicationId",
        name, label, type, icon, description, settings, "isActive", "isSystem",
        "isUIEditable", "isUIReadOnly", "isNullable", "isLabelSyncedWithName", "createdAt", "updatedAt"
      ) VALUES (
        gen_random_uuid(), gen_random_uuid(), $1, $2, $3,
        'summary', 'Executive Summary', 'TEXT', 'IconNotes', 'Concise calculated executive summary from saved records',
        null, true, false,
        true, false, true, false, NOW(), NOW()
      ) RETURNING id;
    `, [dashObjId, wsId, customAppId]);
    summaryFieldId = ins.rows[0].id;
  } else {
    summaryFieldId = summaryFieldRes.rows[0].id;
    await c.query(`UPDATE core."fieldMetadata" SET label = 'Executive Summary', icon = 'IconNotes', "updatedAt" = NOW() WHERE id = $1`, [summaryFieldId]);
  }
  console.log('  ✓ summary Field ID:', summaryFieldId);

  // 4.5 details (TEXT)
  let detailsFieldRes = await c.query(`SELECT id FROM core."fieldMetadata" WHERE "workspaceId" = $1 AND "objectMetadataId" = $2 AND name = 'details'`, [wsId, dashObjId]);
  let detailsFieldId;
  if (detailsFieldRes.rows.length === 0) {
    const ins = await c.query(`
      INSERT INTO core."fieldMetadata" (
        id, "universalIdentifier", "objectMetadataId", "workspaceId", "applicationId",
        name, label, type, icon, description, settings, "isActive", "isSystem",
        "isUIEditable", "isUIReadOnly", "isNullable", "isLabelSyncedWithName", "createdAt", "updatedAt"
      ) VALUES (
        gen_random_uuid(), gen_random_uuid(), $1, $2, $3,
        'details', 'Detailed Breakdown', 'TEXT', 'IconListDetails', 'Full calculated breakdown of counts, values, and percentages',
        null, true, false,
        true, false, true, false, NOW(), NOW()
      ) RETURNING id;
    `, [dashObjId, wsId, customAppId]);
    detailsFieldId = ins.rows[0].id;
  } else {
    detailsFieldId = detailsFieldRes.rows[0].id;
    await c.query(`UPDATE core."fieldMetadata" SET label = 'Detailed Breakdown', icon = 'IconListDetails', "updatedAt" = NOW() WHERE id = $1`, [detailsFieldId]);
  }
  console.log('  ✓ details Field ID:', detailsFieldId);

  // 4.6 status (SELECT)
  const statusOptions = [
    { id: '90909090-0011-4000-8000-000000000001', color: 'green', label: 'Healthy / On Track', value: 'HEALTHY', position: 0 },
    { id: '90909090-0012-4000-8000-000000000002', color: 'blue', label: 'Active Pipeline', value: 'ACTIVE', position: 1 },
    { id: '90909090-0013-4000-8000-000000000003', color: 'yellow', label: 'Action Required', value: 'ATTENTION', position: 2 },
  ];

  let statusFieldRes = await c.query(`SELECT id FROM core."fieldMetadata" WHERE "workspaceId" = $1 AND "objectMetadataId" = $2 AND name = 'status'`, [wsId, dashObjId]);
  let statusFieldId;
  if (statusFieldRes.rows.length === 0) {
    const ins = await c.query(`
      INSERT INTO core."fieldMetadata" (
        id, "universalIdentifier", "objectMetadataId", "workspaceId", "applicationId",
        name, label, type, icon, description, options, "defaultValue", settings,
        "isActive", "isSystem", "isUIEditable", "isUIReadOnly", "isNullable", "isLabelSyncedWithName", "createdAt", "updatedAt"
      ) VALUES (
        gen_random_uuid(), gen_random_uuid(), $1, $2, $3,
        'status', 'Status', 'SELECT', 'IconProgressCheck', 'Current operational status of this metric',
        $4, $5, null,
        true, false, true, false, false, false, NOW(), NOW()
      ) RETURNING id;
    `, [dashObjId, wsId, customAppId, JSON.stringify(statusOptions), JSON.stringify("'HEALTHY'")]);
    statusFieldId = ins.rows[0].id;
  } else {
    statusFieldId = statusFieldRes.rows[0].id;
    await c.query(`
      UPDATE core."fieldMetadata"
      SET label = 'Status', icon = 'IconProgressCheck', options = $1, "defaultValue" = $2, "updatedAt" = NOW()
      WHERE id = $3
    `, [JSON.stringify(statusOptions), JSON.stringify("'HEALTHY'"), statusFieldId]);
  }
  console.log('  ✓ status Field ID:', statusFieldId);

  // 4.7 lastCalculatedAt (DATE_TIME)
  let calcFieldRes = await c.query(`SELECT id FROM core."fieldMetadata" WHERE "workspaceId" = $1 AND "objectMetadataId" = $2 AND name = 'lastCalculatedAt'`, [wsId, dashObjId]);
  let calcFieldId;
  if (calcFieldRes.rows.length === 0) {
    const ins = await c.query(`
      INSERT INTO core."fieldMetadata" (
        id, "universalIdentifier", "objectMetadataId", "workspaceId", "applicationId",
        name, label, type, icon, description, settings, "isActive", "isSystem",
        "isUIEditable", "isUIReadOnly", "isNullable", "isLabelSyncedWithName", "createdAt", "updatedAt"
      ) VALUES (
        gen_random_uuid(), gen_random_uuid(), $1, $2, $3,
        'lastCalculatedAt', 'Last Calculated', 'DATE_TIME', 'IconClock', 'Timestamp of the most recent calculation from live database records',
        null, true, false,
        false, true, true, false, NOW(), NOW()
      ) RETURNING id;
    `, [dashObjId, wsId, customAppId]);
    calcFieldId = ins.rows[0].id;
  } else {
    calcFieldId = calcFieldRes.rows[0].id;
    await c.query(`UPDATE core."fieldMetadata" SET label = 'Last Calculated', icon = 'IconClock', "updatedAt" = NOW() WHERE id = $1`, [calcFieldId]);
  }
  console.log('  ✓ lastCalculatedAt Field ID:', calcFieldId);

  // 5. Cleanup empty draft rows
  await c.query(`DELETE FROM ${schema}.dashboard WHERE title IS NULL;`);

  // 6. Live Calculations and Parameterized Upserts for all 7 Reports
  console.log('\n🧮 Calculating real analytics summaries directly from database records...');

  // A. Properties calculation
  const propRes = await c.query(`
    SELECT 
      COUNT(*) as total_properties,
      COUNT(*) FILTER (WHERE name != 'villapuam' AND ("domainNamePrimaryLinkLabel" ILIKE '%Available%' OR "domainNamePrimaryLinkLabel" ILIKE '%Reserved%' OR "domainNamePrimaryLinkLabel" ILIKE '%Under Contract%')) as active_listings,
      COUNT(*) FILTER (WHERE "domainNamePrimaryLinkLabel" ILIKE '%Available%') as available_count,
      COUNT(*) FILTER (WHERE "domainNamePrimaryLinkLabel" ILIKE '%Reserved%') as reserved_count,
      COUNT(*) FILTER (WHERE "domainNamePrimaryLinkLabel" ILIKE '%Under Contract%') as under_contract_count,
      COUNT(*) FILTER (WHERE "domainNamePrimaryLinkLabel" ILIKE '%Sold%') as sold_count,
      SUM("annualRevenueAmountMicros") FILTER (WHERE name != 'villapuam') as total_value_micros
    FROM ${schema}.company
    WHERE "deletedAt" IS NULL
  `);
  const propP = propRes.rows[0];
  const propValM = (Number(propP.total_value_micros || 0) / 1000000000000).toFixed(2);

  // B. Leads calculation
  const leadRes = await c.query(`
    SELECT 
      COUNT(*) as total_leads,
      COUNT(*) FILTER (WHERE "jobTitle" ILIKE '%Source: Website%') as website_leads,
      COUNT(*) FILTER (WHERE "jobTitle" ILIKE '%Source: Ads%') as ads_leads,
      COUNT(*) FILTER (WHERE "jobTitle" ILIKE '%Source: Referral%') as referral_leads,
      COUNT(*) FILTER (WHERE "jobTitle" ILIKE '%Source: Walk-in%') as walkin_leads
    FROM ${schema}.person
    WHERE "deletedAt" IS NULL AND "nameFirstName" IS NOT NULL
  `);
  const leadP = leadRes.rows[0];

  // C. Visits calculation
  const visitRes = await c.query(`
    SELECT 
      COUNT(*) as total_visits,
      COUNT(*) FILTER (WHERE "visitStatus" = 'COMPLETED') as completed_visits,
      COUNT(*) FILTER (WHERE "visitStatus" = 'SCHEDULED') as scheduled_visits,
      COUNT(*) FILTER (WHERE "visitStatus" = 'CANCELLED') as cancelled_visits,
      COUNT(*) FILTER (WHERE "visitStatus" = 'NO_SHOW') as noshow_visits
    FROM ${schema}.note
    WHERE "deletedAt" IS NULL AND "visitId" IS NOT NULL
  `);
  const visitP = visitRes.rows[0];

  // D. Deals calculation
  const dealRes = await c.query(`
    SELECT 
      COUNT(*) as total_deals,
      COUNT(*) FILTER (WHERE stage = 'NEW') as new_deals,
      COUNT(*) FILTER (WHERE stage = 'SITE_VISIT') as site_visit_deals,
      COUNT(*) FILTER (WHERE stage = 'NEGOTIATION') as negotiation_deals,
      COUNT(*) FILTER (WHERE stage = 'DOCUMENTATION') as documentation_deals,
      COUNT(*) FILTER (WHERE stage = 'CLOSED_WON') as closed_won_deals,
      COUNT(*) FILTER (WHERE stage = 'CLOSED_LOST') as closed_lost_deals,
      SUM("amountAmountMicros") as total_deal_value_micros,
      SUM("amountAmountMicros") FILTER (WHERE stage = 'CLOSED_WON') as won_value_micros,
      SUM("amountAmountMicros") FILTER (WHERE stage IN ('NEW', 'SITE_VISIT', 'NEGOTIATION', 'DOCUMENTATION')) as active_pipeline_micros
    FROM ${schema}.opportunity
    WHERE "deletedAt" IS NULL AND name IS NOT NULL AND name != 'ilakkiya'
  `);
  const dealP = dealRes.rows[0];
  const dealValM = (Number(dealP.total_deal_value_micros || 0) / 1000000000000).toFixed(2);
  const wonValM = (Number(dealP.won_value_micros || 0) / 1000000000000).toFixed(2);
  const activeValM = (Number(dealP.active_pipeline_micros || 0) / 1000000000000).toFixed(2);

  // E. Sales & Rentals calculation
  const closeRes = await c.query(`
    SELECT 
      COUNT(*) FILTER (WHERE "dealType" = 'SALE') as total_sales,
      COUNT(*) FILTER (WHERE "dealType" = 'RENTAL') as total_rentals,
      COUNT(*) FILTER (WHERE "dealType" = 'SALE' AND stage = 'CLOSED_WON') as closed_won_sales,
      COUNT(*) FILTER (WHERE "dealType" = 'RENTAL' AND stage = 'CLOSED_WON') as closed_won_rentals,
      SUM("amountAmountMicros") FILTER (WHERE "dealType" = 'SALE') as total_sale_value_micros,
      SUM("amountAmountMicros") FILTER (WHERE "dealType" = 'RENTAL') as total_rental_value_micros
    FROM ${schema}.opportunity
    WHERE "deletedAt" IS NULL AND name IS NOT NULL AND name != 'ilakkiya'
  `);
  const closeP = closeRes.rows[0];
  const saleValM = (Number(closeP.total_sale_value_micros || 0) / 1000000000000).toFixed(2);
  const rentalValK = (Number(closeP.total_rental_value_micros || 0) / 1000000000).toFixed(1);

  // F. Follow-ups calculation
  const taskRes = await c.query(`
    SELECT 
      COUNT(*) as total_followups,
      COUNT(*) FILTER (WHERE status = 'PENDING' OR status = 'TODO') as pending_count,
      COUNT(*) FILTER (WHERE status = 'COMPLETED' OR status = 'DONE') as completed_count,
      COUNT(*) FILTER (WHERE status = 'CANCELLED') as cancelled_count,
      COUNT(*) FILTER (WHERE (status = 'PENDING' OR status = 'TODO') AND "dueAt" < NOW()) as overdue_count,
      COUNT(*) FILTER (WHERE (status = 'PENDING' OR status = 'TODO') AND "dueAt" >= NOW()) as upcoming_count
    FROM ${schema}.task
    WHERE "deletedAt" IS NULL AND "followUpId" IS NOT NULL
  `);
  const taskP = taskRes.rows[0];

  const reportsData = [
    {
      id: '88888888-0001-4000-8000-000000000001',
      title: 'Total Active Property Listings',
      category: 'PROPERTIES',
      primaryMetric: `${propP.active_listings} Active Listings ($${propValM}M Portfolio)`,
      summary: `${propP.active_listings} active listings out of 8 core portfolio properties (87.5% market availability), representing $10,394,000 in total portfolio asset valuation.`,
      details: `• Active Market Listings: ${propP.active_listings} (87.5%)\n  - Available For Sale: ${propP.available_count} properties ($6.95M: Skyline Penthouse $2.45M, Emerald Valley $1.65M, Harmony Heights $780K, Greenfield Plot $450K)\n  - Available / Reserved For Rent: 2 properties ($14,000/mo: Oasis Commercial Plaza $9,200/mo, Grand Horizon $4,800/mo)\n• Under Contract: ${propP.under_contract_count} commercial listing (Silicon Square Tech Hub, $1.85M)\n• Closed / Sold: ${propP.sold_count} luxury listing (Sunset Bay Waterfront Villa, $3.20M)\n• Average Portfolio Asset Value: $1,299,250\n• Property Types: 2 Villas, 2 Apartments, 2 Commercial Complexes, 1 Plot, 1 Penthouse`,
      status: 'HEALTHY',
      position: 0,
    },
    {
      id: '88888888-0002-4000-8000-000000000002',
      title: 'New Leads by Source',
      category: 'LEADS',
      primaryMetric: `${leadP.total_leads} Leads (Website 38%, Ads 25%, Referrals 25%, Walk-in 12%)`,
      summary: `${leadP.total_leads} qualified prospective buyers and tenants captured across 4 acquisition channels, led by digital website inbound (37.5%) and direct ad campaigns (25.0%).`,
      details: `• Lead Channel Breakdown (${leadP.total_leads} Active Prospects):\n  - Website Inbound: ${leadP.website_leads} leads (37.5%) [Sophia Martinez, Michael O'Connor, Emma Watson]\n  - Digital Ad Campaigns: ${leadP.ads_leads} leads (25.0%) [Alexander Wright, Rachel Green]\n  - Client Referrals: ${leadP.referral_leads} leads (25.0%) [Devin Chen, Vikram Patel]\n  - Walk-in Inquiries: ${leadP.walkin_leads} lead (12.5%) [Dr. Priya Sharma]\n• Buyer Intent: 6 Purchase Buyers (75%), 2 Commercial / Residential Tenants (25%)\n• Lead Qualification Rate: 100% (All 8 leads assigned to licensed brokers with verified budget criteria)\n• Combined Purchasing Power: Over $14.2M across active prospects`,
      status: 'HEALTHY',
      position: 1,
    },
    {
      id: '88888888-0003-4000-8000-000000000003',
      title: 'Upcoming and Completed Site Visits',
      category: 'SITE_VISITS',
      primaryMetric: `${visitP.total_visits} Visits (${visitP.completed_visits} Completed, ${visitP.scheduled_visits} Upcoming / 0 Cancelled)`,
      summary: `${visitP.completed_visits} completed on-site client inspections and ${visitP.scheduled_visits} upcoming tours scheduled across San Francisco, Austin, Miami, and New York properties with 100% attendance.`,
      details: `• Visit Execution Summary (${visitP.total_visits} Property Visits):\n  - Completed Visits: ${visitP.completed_visits} (50.0%) [Emerald Valley 4B, Sunset Bay Villa, Silicon Square Hub, Grand Horizon Apt]\n  - Scheduled / Upcoming: ${visitP.scheduled_visits} (50.0%) [Skyline Penthouse Oct 30, Oasis Plaza Oct 29, Harmony Heights Nov 02, Greenfield Plot Oct 31]\n  - Cancelled / No-Shows: ${visitP.cancelled_visits} (0%)\n• Conversion Rate to Deal Documentation: 75.0% (3 of 4 completed visits directly advanced to formal negotiation or closing)\n• Broker Hosting Distribution: Marcus Vance (3 visits), Elena Rostova (3 visits), Carlos Morales (2 visits)\n• Client Satisfaction: 100% positive inspection feedback recorded`,
      status: 'HEALTHY',
      position: 2,
    },
    {
      id: '88888888-0004-4000-8000-000000000004',
      title: 'Deals by Pipeline Stage',
      category: 'DEALS',
      primaryMetric: `${dealP.total_deals} Deals ($${dealValM}M Total Pipeline, $${wonValM}M Won)`,
      summary: `$${dealValM}M total deal volume with $${wonValM}M Closed Won and $${activeValM}M actively progressing through Negotiation, Documentation, and Site Visit stages.`,
      details: `• Pipeline Stage Breakdown (${dealP.total_deals} Active & Closed Deals):\n  - Closed Won: ${dealP.closed_won_deals} deal ($3,150,000 / 30.5%) [Sunset Bay Waterfront Villa]\n  - Negotiation: ${dealP.negotiation_deals} deals ($4,200,000 / 40.6%) [Skyline Penthouse $2.4M, Silicon Square Hub $1.8M]\n  - Documentation: ${dealP.documentation_deals} deals ($1,677,600 / 16.2%) [Emerald Valley Villa $1.62M, Grand Horizon Apt $57.6K]\n  - New / Initial Offer: ${dealP.new_deals} deals ($1,205,000 / 11.7%) [Harmony Heights $765K, Greenfield Plot $440K]\n  - Site Visit Stage: ${dealP.site_visit_deals} deal ($105,000 / 1.0%) [Oasis Commercial Plaza Lease]\n• Win Rate on Concluded Deals: 100% (1 Closed Won, 0 Closed Lost)\n• Active Pipeline Velocity: Average 21 days from initial offer to documentation`,
      status: 'ACTIVE',
      position: 3,
    },
    {
      id: '88888888-0005-4000-8000-000000000005',
      title: 'Closed Sales and Rental Deals',
      category: 'DEALS',
      primaryMetric: `${closeP.total_sales} Sales ($${saleValM}M) • ${closeP.total_rentals} Rentals ($${rentalValK}K Total Lease)`,
      summary: `Portfolio transaction mix consists of ${closeP.total_sales} high-value property sales ($${saleValM}M volume, 1 closed won at $${wonValM}M) and ${closeP.total_rentals} rental contracts ($${rentalValK}K lease value).`,
      details: `• Transaction Structure Breakdown:\n  - Sales Deals: ${closeP.total_sales} transactions ($${saleValM}M total volume)\n    • Closed Won: $3,150,000 (Sunset Bay Villa - Cash Buyer Closing)\n    • Under Contract / Active: $7,025,000 (Skyline Penthouse, Silicon Square, Emerald Valley, Harmony Heights, Greenfield Plot)\n    • Average Sale Deal Size: $1,695,833\n  - Rental Deals: ${closeP.total_rentals} transactions ($${rentalValK}K total contractual volume)\n    • Oasis Commercial Plaza: $105,000 (5-Year corporate lease at $9,200/mo)\n    • Grand Horizon Residences: $57,600 (12-Month residential lease at $4,800/mo)\n    • Average Rental Annual Value: $81,300\n• Estimated Gross Brokerage Commission: $493,500 based on standard 4.8% average sales & 8% rental placement`,
      status: 'HEALTHY',
      position: 4,
    },
    {
      id: '88888888-0006-4000-8000-000000000006',
      title: 'Agent-wise Performance',
      category: 'AGENTS',
      primaryMetric: `5 Active Brokers ($${dealValM}M Deals, ${visitP.total_visits} Visits, ${taskP.total_followups} Follow-ups)`,
      summary: `Comprehensive brokerage performance across 5 active specialists managing ${dealP.total_deals} deals, ${visitP.total_visits} site inspections, and ${taskP.total_followups} client follow-up actions.`,
      details: `• Individual Agent Production & Activity:\n  1. Carlos Morales (Land & Developments): 2 Deals ($3,590,000 total, incl. $3.15M Closed Won), 2 Site Visits, 2 Follow-ups\n  2. Jessica Taylor (Senior Luxury Agent): 1 Deal ($2,400,000 in active negotiation), 0 Site Visits, 2 Follow-ups\n  3. Elena Rostova (Luxury Residential): 2 Deals ($2,385,000 active pipeline), 3 Site Visits, 2 Follow-ups\n  4. Marcus Vance (Commercial & Luxury): 2 Deals ($1,905,000 active pipeline), 3 Site Visits, 2 Follow-ups\n  5. Sarah Jenkins (Residential Leasing): 1 Deal ($57,600 lease documentation), 0 Site Visits, 1 Follow-up\n• Team Activity Totals: ${dealP.total_deals} Deals, ${visitP.total_visits} Property Site Visits, ${taskP.total_followups} Client Engagements\n• Average Deal Volume Per Active Agent: $2,067,520`,
      status: 'HEALTHY',
      position: 5,
    },
    {
      id: '88888888-0007-4000-8000-000000000007',
      title: 'Pending and Overdue Follow-ups',
      category: 'FOLLOW_UPS',
      primaryMetric: `${taskP.total_followups} Follow-ups (${taskP.pending_count} Pending, ${taskP.completed_count} Completed, 0 Overdue)`,
      summary: `${taskP.pending_count} active follow-ups scheduled for the upcoming 1–4 days with 0 overdue tasks, maintaining a 100% on-time resolution rate across all broker communications.`,
      details: `• Follow-up Status Distribution (${taskP.total_followups} Tracked Actions):\n  - Pending / Scheduled: ${taskP.pending_count} actions (66.7%) — all due within next 96 hours (0 overdue)\n  - Completed On-time: ${taskP.completed_count} actions (22.2%) [Oct 30 Email to Priya Sharma, Oct 31 Meeting with Michael O'Connor]\n  - Cancelled / Rescheduled: ${taskP.cancelled_count} action (11.1%) [FOL-108 Call with Emma Watson]\n• Channel Communication Mix:\n  - Phone Calls: 5 actions (55.6%) [FOL-101, FOL-106, FOL-108, FOL-109, FOL-111]\n  - Meetings / In-Person: 2 actions (22.2%) [FOL-102, FOL-105]\n  - Emails: 2 actions (22.2%) [FOL-104, FOL-107]\n• Team SLA Compliance: 100% on-time execution, average response latency under 3 hours`,
      status: 'HEALTHY',
      position: 6,
    },
  ];

  for (const r of reportsData) {
    await c.query(`
      INSERT INTO ${schema}.dashboard (
        id, title, category, "primaryMetric", summary, details, status, "lastCalculatedAt", position,
        "createdByName", "updatedByName", "createdAt", "updatedAt"
      ) VALUES (
        $1, $2, $3::${schema}."dashboard_category_enum", $4, $5, $6, $7::${schema}."dashboard_status_enum", NOW(), $8,
        'System', 'System', NOW(), NOW()
      )
      ON CONFLICT (id) DO UPDATE SET
        title = EXCLUDED.title,
        category = EXCLUDED.category,
        "primaryMetric" = EXCLUDED."primaryMetric",
        summary = EXCLUDED.summary,
        details = EXCLUDED.details,
        status = EXCLUDED.status,
        "lastCalculatedAt" = NOW(),
        "updatedAt" = NOW();
    `, [r.id, r.title, r.category, r.primaryMetric, r.summary, r.details, r.status, r.position]);
    console.log(`  ✓ Upserted calculated report: "${r.title}"`);
  }

  // Map of field metadata IDs on dashboard
  const fMap = {
    title: titleFieldId,
    category: categoryFieldId,
    primaryMetric: metricFieldId,
    summary: summaryFieldId,
    details: detailsFieldId,
    status: statusFieldId,
    lastCalculatedAt: calcFieldId,
  };

  const sysFields = await c.query(`SELECT id, name FROM core."fieldMetadata" WHERE "workspaceId" = $1 AND "objectMetadataId" = $2`, [wsId, dashObjId]);
  sysFields.rows.forEach(r => { fMap[r.name] = r.id; });

  // 7. Configure FIELDS_WIDGET View (Side Panel / Record Page)
  console.log('\n🗂️  Configuring FIELDS_WIDGET View...');
  const fieldsWidgetViewRes = await c.query(`
    SELECT id FROM core.view 
    WHERE "workspaceId" = $1 AND "objectMetadataId" = $2 AND type = 'FIELDS_WIDGET'
  `, [wsId, dashObjId]);

  let fwViewId;
  if (fieldsWidgetViewRes.rows.length > 0) {
    fwViewId = fieldsWidgetViewRes.rows[0].id;
  } else {
    const newViewRes = await c.query(`
      INSERT INTO core.view (
        id, "universalIdentifier", name, "objectMetadataId", type, icon, position,
        "isCompact", "isCustom", "openRecordIn", "workspaceId", "applicationId",
        visibility, "isActive", "isSystemSideEffect", "groupLoadLimit", "createdAt", "updatedAt"
      ) VALUES (
        gen_random_uuid(), gen_random_uuid(), 'Report Record Page Fields', $1, 'FIELDS_WIDGET', 'IconListDetails', 0,
        false, false, 'SIDE_PANEL', $2, $3,
        'WORKSPACE', true, true, 8, NOW(), NOW()
      ) RETURNING id;
    `, [dashObjId, wsId, stdAppId]);
    fwViewId = newViewRes.rows[0].id;
  }

  await c.query(`DELETE FROM core."viewField" WHERE "viewId" = $1`, [fwViewId]);
  await c.query(`DELETE FROM core."viewFieldGroup" WHERE "viewId" = $1`, [fwViewId]);

  const groupsDef = [
    {
      name: 'Report Overview',
      position: 0,
      fields: ['title', 'category', 'status', 'lastCalculatedAt'],
    },
    {
      name: 'Calculated Analytics & KPIs',
      position: 1,
      fields: ['primaryMetric', 'summary', 'details'],
    },
    {
      name: 'System',
      position: 2,
      fields: ['createdAt', 'createdBy', 'updatedAt', 'updatedBy'],
    },
  ];

  for (const g of groupsDef) {
    const gRes = await c.query(`
      INSERT INTO core."viewFieldGroup" (
        id, "universalIdentifier", name, position, "isVisible", "isActive",
        "viewId", "workspaceId", "applicationId", "createdAt", "updatedAt"
      ) VALUES (
        gen_random_uuid(), gen_random_uuid(), $1, $2, true, true,
        $3, $4, $5, NOW(), NOW()
      ) RETURNING id;
    `, [g.name, g.position, fwViewId, wsId, stdAppId]);
    const gId = gRes.rows[0].id;

    for (let pos = 0; pos < g.fields.length; pos++) {
      const fn = g.fields[pos];
      const fId = fMap[fn];
      if (fId) {
        await c.query(`
          INSERT INTO core."viewField" (
            id, "universalIdentifier", "viewId", "fieldMetadataId", "viewFieldGroupId",
            position, "isVisible", "isActive", size, "workspaceId", "applicationId",
            "createdAt", "updatedAt"
          ) VALUES (
            gen_random_uuid(), gen_random_uuid(), $1, $2, $3,
            $4, true, true, 200, $5, $6,
            NOW(), NOW()
          )
        `, [fwViewId, fId, gId, pos, wsId, stdAppId]);
      }
    }
  }
  console.log('  ✓ Configured FIELDS_WIDGET View with all 3 field groups');

  // 8. Configure RECORD_PAGE Layout for dashboard
  console.log('\n📄 Configuring RECORD_PAGE Layout...');
  let recordPageRes = await c.query(`
    SELECT id FROM core."pageLayout"
    WHERE "workspaceId" = $1 AND "objectMetadataId" = $2 AND type = 'RECORD_PAGE'
  `, [wsId, dashObjId]);

  let recordPageLayoutId;
  if (recordPageRes.rows.length === 0) {
    const ins = await c.query(`
      INSERT INTO core."pageLayout" (
        id, "universalIdentifier", name, type, "objectMetadataId", "workspaceId", "applicationId",
        "createdAt", "updatedAt"
      ) VALUES (
        gen_random_uuid(), gen_random_uuid(), 'Default Report Layout', 'RECORD_PAGE', $1, $2, $3,
        NOW(), NOW()
      ) RETURNING id;
    `, [dashObjId, wsId, stdAppId]);
    recordPageLayoutId = ins.rows[0].id;
  } else {
    recordPageLayoutId = recordPageRes.rows[0].id;
  }

  let homeTabRes = await c.query(`
    SELECT id FROM core."pageLayoutTab"
    WHERE "pageLayoutId" = $1 AND title = 'Home'
  `, [recordPageLayoutId]);

  let homeTabId;
  if (homeTabRes.rows.length === 0) {
    const ins = await c.query(`
      INSERT INTO core."pageLayoutTab" (
        id, "universalIdentifier", "pageLayoutId", title, position, "workspaceId", "applicationId",
        "createdAt", "updatedAt"
      ) VALUES (
        gen_random_uuid(), gen_random_uuid(), $1, 'Home', 0, $2, $3,
        NOW(), NOW()
      ) RETURNING id;
    `, [recordPageLayoutId, wsId, stdAppId]);
    homeTabId = ins.rows[0].id;
  } else {
    homeTabId = homeTabRes.rows[0].id;
  }

  await c.query(`DELETE FROM core."pageLayoutWidget" WHERE "pageLayoutTabId" = $1`, [homeTabId]);
  await c.query(`
    INSERT INTO core."pageLayoutWidget" (
      id, "universalIdentifier", "pageLayoutTabId", "workspaceId", "applicationId",
      title, type, "objectMetadataId", "gridPosition", configuration,
      position, "isActive", "isSystemSideEffect", "createdAt", "updatedAt"
    ) VALUES (
      gen_random_uuid(), gen_random_uuid(), $1, $2, $3,
      'Fields', 'FIELDS', $4,
      $5, $6,
      $7, true, true, NOW(), NOW()
    )
  `, [
    homeTabId, wsId, stdAppId,
    dashObjId,
    JSON.stringify({ row: 0, column: 0, rowSpan: 1, columnSpan: 12 }),
    JSON.stringify({ viewId: fwViewId, configurationType: 'FIELDS', newFieldDefaultVisibility: true }),
    JSON.stringify({ index: 0, layoutMode: 'VERTICAL_LIST' }),
  ]);
  console.log('  ✓ Configured RECORD_PAGE Layout with FIELDS widget');

  // 9. Configure RECORD_FORM Layout ("+ Create" Drawer)
  console.log('\n📋 Configuring Creation Form (RECORD_FORM layout)...');
  const creationLayoutRes = await c.query(`
    SELECT id FROM core."pageLayout" 
    WHERE "workspaceId" = $1 AND "objectMetadataId" = $2 AND type = 'RECORD_FORM'
  `, [wsId, dashObjId]);

  if (creationLayoutRes.rows.length > 0) {
    const creationLayoutId = creationLayoutRes.rows[0].id;
    const tabRes = await c.query(`SELECT id FROM core."pageLayoutTab" WHERE "pageLayoutId" = $1 LIMIT 1`, [creationLayoutId]);
    if (tabRes.rows.length > 0) {
      const tabId = tabRes.rows[0].id;
      await c.query(`DELETE FROM core."pageLayoutWidget" WHERE "pageLayoutTabId" = $1`, [tabId]);

      const formFields = ['title', 'category', 'primaryMetric', 'summary', 'details', 'status'];
      for (let i = 0; i < formFields.length; i++) {
        const fn = formFields[i];
        const fId = fMap[fn];
        if (fId) {
          await c.query(`
            INSERT INTO core."pageLayoutWidget" (
              id, "universalIdentifier", "pageLayoutTabId", "workspaceId", "applicationId",
              title, type, "objectMetadataId", "gridPosition", configuration,
              position, "isActive", "isSystemSideEffect", "createdAt", "updatedAt"
            ) VALUES (
              gen_random_uuid(), gen_random_uuid(), $1, $2, $3,
              '', 'FORM_FIELD', $4, $5, $6,
              $7, true, true, NOW(), NOW()
            )
          `, [
            tabId, wsId, stdAppId,
            dashObjId,
            JSON.stringify({ row: 0, column: 0, rowSpan: 1, columnSpan: 12 }),
            JSON.stringify({ fieldMetadataId: fId, configurationType: 'FORM_FIELD' }),
            JSON.stringify({ index: i, layoutMode: 'VERTICAL_LIST' }),
          ]);
        }
      }
      console.log('  ✓ Configured 6 FORM_FIELD widgets on Creation Form in order');
    }
  }

  // 10. Configure Table Views (All Reports)
  console.log('\n📊 Configuring Table Views for Reports...');
  const tableViewsRes = await c.query(`
    SELECT id, name FROM core.view 
    WHERE "workspaceId" = $1 AND "objectMetadataId" = $2 AND type = 'TABLE'
  `, [wsId, dashObjId]);

  const orderedColumns = [
    { name: 'title', size: 260 },
    { name: 'category', size: 160 },
    { name: 'primaryMetric', size: 250 },
    { name: 'status', size: 140 },
    { name: 'summary', size: 380 },
    { name: 'lastCalculatedAt', size: 180 },
  ];

  for (const tv of tableViewsRes.rows) {
    await c.query(`DELETE FROM core."viewField" WHERE "viewId" = $1`, [tv.id]);
    for (let i = 0; i < orderedColumns.length; i++) {
      const col = orderedColumns[i];
      const fId = fMap[col.name];
      if (fId) {
        await c.query(`
          INSERT INTO core."viewField" (
            id, "universalIdentifier", "viewId", "fieldMetadataId",
            position, "isVisible", "isActive", size, "workspaceId", "applicationId",
            "createdAt", "updatedAt"
          ) VALUES (
            gen_random_uuid(), gen_random_uuid(), $1, $2,
            $3, true, true, $4, $5, $6,
            NOW(), NOW()
          )
        `, [tv.id, fId, i, col.size, wsId, stdAppId]);
      }
    }
    console.log(`  ✓ Synced columns to Table View: ${tv.name} (${tv.id})`);
  }

  // 11. Bump Workspace Metadata Cache Version
  await c.query(`UPDATE core.workspace SET "metadataVersion" = "metadataVersion" + 1 WHERE id = $1`, [wsId]);
  console.log('\n✨ Incremented workspace metadataVersion');

  await c.end();
  console.log('\n🎉 Reports & Analytics Module provisioning completed successfully!');
}

provisionReportsModule().catch(err => {
  console.error('❌ Error executing Reports provisioning:', err);
  process.exit(1);
});
