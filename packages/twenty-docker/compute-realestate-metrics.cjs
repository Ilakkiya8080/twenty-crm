const { Client } = require('pg');

async function computeRealMetrics() {
  const c = new Client({
    connectionString: process.env.PG_DATABASE_URL || 'postgres://postgres:postgres@db:5432/default',
  });
  await c.connect();

  const schema = 'workspace_306npwj88jcxnl7zwdogk8bw8';

  console.log('=== EXACT CALCULATIONS FROM REAL SAVED RECORDS ===\n');

  // 1. Total active property listings
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
  console.log('1. Property Metrics:', propRes.rows[0]);

  // 2. New leads by source
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
  console.log('\n2. Lead Metrics by Source:', leadRes.rows[0]);

  // 3. Upcoming and completed site visits
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
  console.log('\n3. Site Visit Metrics:', visitRes.rows[0]);

  // 4. Deals by pipeline stage
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
  console.log('\n4. Deal Pipeline Metrics:', dealRes.rows[0]);

  // 5. Closed sales and rental deals
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
  console.log('\n5. Closed Sales & Rentals:', closeRes.rows[0]);

  // 6. Agent-wise performance
  const agentRes = await c.query(`
    SELECT 
      wm.id,
      wm."nameFirstName" || ' ' || COALESCE(wm."nameLastName", '') as name,
      wm."jobTitle",
      (SELECT COUNT(*) FROM ${schema}.opportunity o WHERE (o."ownerId" = wm.id) AND o."deletedAt" IS NULL) as deal_count,
      (SELECT COALESCE(SUM(o."amountAmountMicros"), 0) FROM ${schema}.opportunity o WHERE (o."ownerId" = wm.id) AND o."deletedAt" IS NULL) as deal_volume_micros,
      (SELECT COUNT(*) FROM ${schema}.note n WHERE n."assignedAgentId" = wm.id AND n."deletedAt" IS NULL) as visit_count,
      (SELECT COUNT(*) FROM ${schema}.task t WHERE t."assigneeId" = wm.id AND t."deletedAt" IS NULL) as task_count
    FROM ${schema}."workspaceMember" wm
    WHERE wm."nameFirstName" IS NOT NULL
    ORDER BY deal_volume_micros DESC
  `);
  console.log('\n6. Agent-wise Performance:', agentRes.rows);

  // 7. Pending and overdue follow-ups
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
  console.log('\n7. Follow-up Metrics:', taskRes.rows[0]);

  await c.end();
}

computeRealMetrics().catch(console.error);
