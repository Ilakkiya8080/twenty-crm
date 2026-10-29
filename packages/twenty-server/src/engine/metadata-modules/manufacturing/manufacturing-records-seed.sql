-- ============================================================================
-- MANUFACTURING CRM RECORDS SEED SCRIPT
-- ============================================================================
DO $$
DECLARE
    ws_id UUID;
    db_schema TEXT;

    -- Suppliers (company)
    sup1 UUID := '22222222-0001-5000-8000-000000000001';
    sup2 UUID := '22222222-0002-5000-8000-000000000002';
    sup3 UUID := '22222222-0003-5000-8000-000000000003';
    sup4 UUID := '22222222-0004-5000-8000-000000000004';
    sup5 UUID := '22222222-0005-5000-8000-000000000005';
    sup6 UUID := '22222222-0006-5000-8000-000000000006';
    sup7 UUID := '22222222-0007-5000-8000-000000000007';
    sup8 UUID := '22222222-0008-5000-8000-000000000008';

    -- Products (person)
    prd1 UUID := '11111111-0001-5000-8000-000000000001';
    prd2 UUID := '11111111-0002-5000-8000-000000000002';
    prd3 UUID := '11111111-0003-5000-8000-000000000003';
    prd4 UUID := '11111111-0004-5000-8000-000000000004';
    prd5 UUID := '11111111-0005-5000-8000-000000000005';
    prd6 UUID := '11111111-0006-5000-8000-000000000006';
    prd7 UUID := '11111111-0007-5000-8000-000000000007';
    prd8 UUID := '11111111-0008-5000-8000-000000000008';

    -- Production Orders (opportunity)
    ord1 UUID := '44444444-0001-5000-8000-000000000001';
    ord2 UUID := '44444444-0002-5000-8000-000000000002';
    ord3 UUID := '44444444-0003-5000-8000-000000000003';
    ord4 UUID := '44444444-0004-5000-8000-000000000004';
    ord5 UUID := '44444444-0005-5000-8000-000000000005';
    ord6 UUID := '44444444-0006-5000-8000-000000000006';
    ord7 UUID := '44444444-0007-5000-8000-000000000007';
    ord8 UUID := '44444444-0008-5000-8000-000000000008';

    -- Raw Materials (task)
    mat1 UUID := '55555555-0001-5000-8000-000000000001';
    mat2 UUID := '55555555-0002-5000-8000-000000000002';
    mat3 UUID := '55555555-0003-5000-8000-000000000003';
    mat4 UUID := '55555555-0004-5000-8000-000000000004';
    mat5 UUID := '55555555-0005-5000-8000-000000000005';
    mat6 UUID := '55555555-0006-5000-8000-000000000006';
    mat7 UUID := '55555555-0007-5000-8000-000000000007';
    mat8 UUID := '55555555-0008-5000-8000-000000000008';

    -- Inventory (note)
    inv1 UUID := '77777777-0001-5000-8000-000000000001';
    inv2 UUID := '77777777-0002-5000-8000-000000000002';
    inv3 UUID := '77777777-0003-5000-8000-000000000003';
    inv4 UUID := '77777777-0004-5000-8000-000000000004';
    inv5 UUID := '77777777-0005-5000-8000-000000000005';
    inv6 UUID := '77777777-0006-5000-8000-000000000006';
    inv7 UUID := '77777777-0007-5000-8000-000000000007';
    inv8 UUID := '77777777-0008-5000-8000-000000000008';

    -- Quality Control (dashboard)
    qc1 UUID := '66666666-0001-5000-8000-000000000001';
    qc2 UUID := '66666666-0002-5000-8000-000000000002';
    qc3 UUID := '66666666-0003-5000-8000-000000000003';
    qc4 UUID := '66666666-0004-5000-8000-000000000004';
    qc5 UUID := '66666666-0005-5000-8000-000000000005';
    qc6 UUID := '66666666-0006-5000-8000-000000000006';
    qc7 UUID := '66666666-0007-5000-8000-000000000007';
    qc8 UUID := '66666666-0008-5000-8000-000000000008';
BEGIN
    SELECT id, "databaseSchema" INTO ws_id, db_schema
    FROM core.workspace
    WHERE "deletedAt" IS NULL
    ORDER BY "createdAt" DESC
    LIMIT 1;

    -- Clean existing records in tables
    EXECUTE format('DELETE FROM %I."timelineActivity"', db_schema);
    EXECUTE format('DELETE FROM %I."taskTarget"', db_schema);
    EXECUTE format('DELETE FROM %I.task', db_schema);
    EXECUTE format('DELETE FROM %I.opportunity', db_schema);
    EXECUTE format('DELETE FROM %I.person', db_schema);
    EXECUTE format('DELETE FROM %I.company', db_schema);
    EXECUTE format('DELETE FROM %I.note', db_schema);
    EXECUTE format('DELETE FROM %I.dashboard', db_schema);

    -- A. Suppliers (company)
    EXECUTE format('
        INSERT INTO %I.company (
            id, name, "domainNamePrimaryLinkLabel", "domainNamePrimaryLinkUrl", "linkedinLinkPrimaryLinkLabel", "linkedinLinkPrimaryLinkUrl", "addressAddressStreet1", "addressAddressCity",
            position, "createdByName", "updatedByName", "createdBySource", "updatedBySource", "createdAt", "updatedAt"
        ) VALUES
            (%L, ''Apex Precision Alloys & Metals'', ''apexalloys.com'', ''apexalloys.com'', ''Marcus Sterling (VP Supply Chain)'', ''https://linkedin.com'', ''104 Industrial Parkway, Building 4'', ''Detroit, MI'', 0, ''System'', ''System'', ''MANUAL'', ''MANUAL'', NOW(), NOW()),
            (%L, ''Global Chemical & Polymer Corp'', ''globalchemical.com'', ''globalchemical.com'', ''Elena Rostova (Head of Procurement)'', ''https://linkedin.com'', ''Pier 9, Logistics Harbor Terminal'', ''Houston, TX'', 1, ''System'', ''System'', ''MANUAL'', ''MANUAL'', NOW(), NOW()),
            (%L, ''MicroTech Semiconductor Solutions'', ''microtech-ic.com'', ''microtech-ic.com'', ''Takeshi Tanaka (Senior Director)'', ''https://linkedin.com'', ''502 Tech Blvd, Silicon Corridor'', ''San Jose, CA'', 2, ''System'', ''System'', ''MANUAL'', ''MANUAL'', NOW(), NOW()),
            (%L, ''Fastener & Heavy Hardware Dynamics'', ''fastenerdynamics.com'', ''fastenerdynamics.com'', ''Carlos Morales (Industrial Sales Mgr)'', ''https://linkedin.com'', ''77 Hardware Blvd, Zone 3'', ''Chicago, IL'', 3, ''System'', ''System'', ''MANUAL'', ''MANUAL'', NOW(), NOW()),
            (%L, ''HydraFlow Actuation Systems'', ''hydraflow.co.uk'', ''hydraflow.co.uk'', ''Liam Gallagher (VP Fluid Power)'', ''https://linkedin.com'', ''12 Aeropark Drive, Hangar 6'', ''Seattle, WA'', 4, ''System'', ''System'', ''MANUAL'', ''MANUAL'', NOW(), NOW()),
            (%L, ''EcoPackaging & Industrial Crating'', ''ecopackaging.com'', ''ecopackaging.com'', ''Brigitte Meyer (Logistics Director)'', ''https://linkedin.com'', ''Logistics Terminal B, Bay 7'', ''Atlanta, GA'', 5, ''System'', ''System'', ''MANUAL'', ''MANUAL'', NOW(), NOW()),
            (%L, ''OmniSensors Industrial Automation'', ''omnisensors.com'', ''omnisensors.com'', ''Henrik Lindqvist (Chief Engineer)'', ''https://linkedin.com'', ''340 Robotics Way, Suite 100'', ''Boston, MA'', 6, ''System'', ''System'', ''MANUAL'', ''MANUAL'', NOW(), NOW()),
            (%L, ''Vanguard Composite Materials'', ''vanguardcomposites.com'', ''vanguardcomposites.com'', ''Dr. Sandra Patel (Materials Science Lead)'', ''https://linkedin.com'', ''88 Carbon Road, Advanced Tech Park'', ''Austin, TX'', 7, ''System'', ''System'', ''MANUAL'', ''MANUAL'', NOW(), NOW())
    ', db_schema, sup1, sup2, sup3, sup4, sup5, sup6, sup7, sup8);

    -- B. Products (person table)
    EXECUTE format('
        INSERT INTO %I.person (
            id, "nameFirstName", "nameLastName", "emailsPrimaryEmail", "phonesPrimaryPhoneNumber", "jobTitle", "companyId",
            position, "createdByName", "updatedByName", "createdBySource", "updatedBySource", "createdAt", "updatedAt"
        ) VALUES
            (%L, ''Industrial AC'', ''Servo Motor V4'', ''SKU-7001'', ''$1,250.00 / unit'', ''Propulsion & Motion • Unit: pcs • Cost: $420 • Status: Active'', %L, 0, ''System'', ''System'', ''MANUAL'', ''MANUAL'', NOW(), NOW()),
            (%L, ''Microprocessor Control'', ''Board X10'', ''SKU-7002'', ''$220.00 / unit'', ''Sensors & Control • Unit: pcs • Cost: $65 • Status: Active'', %L, 1, ''System'', ''System'', ''MANUAL'', ''MANUAL'', NOW(), NOW()),
            (%L, ''Heavy-Duty Hydraulic'', ''Actuator 5000'', ''SKU-7003'', ''$780.00 / unit'', ''Automation & Fluid • Unit: pcs • Cost: $260 • Status: Active'', %L, 2, ''System'', ''System'', ''MANUAL'', ''MANUAL'', NOW(), NOW()),
            (%L, ''Modular Lithium Power'', ''Pack 48V'', ''SKU-7004'', ''$2,650.00 / unit'', ''Energy & Storage • Unit: pcs • Cost: $890 • Status: Active'', %L, 3, ''System'', ''System'', ''MANUAL'', ''MANUAL'', NOW(), NOW()),
            (%L, ''CNC Milled Aluminum'', ''Chassis 200'', ''SKU-7005'', ''$340.00 / unit'', ''Structural Frames • Unit: pcs • Cost: $110 • Status: Active'', %L, 4, ''System'', ''System'', ''MANUAL'', ''MANUAL'', NOW(), NOW()),
            (%L, ''High-Efficiency Gas'', ''Turbine Impeller'', ''SKU-7006'', ''$4,850.00 / unit'', ''Turbomachinery • Unit: pcs • Cost: $1,450 • Status: Active'', %L, 5, ''System'', ''System'', ''MANUAL'', ''MANUAL'', NOW(), NOW()),
            (%L, ''Multi-Axis MEMS'', ''Vibration Sensor'', ''SKU-7007'', ''$175.00 / unit'', ''IoT Diagnostics • Unit: pcs • Cost: $45 • Status: Active'', %L, 6, ''System'', ''System'', ''MANUAL'', ''MANUAL'', NOW(), NOW()),
            (%L, ''Aerospace Carbon Fiber'', ''Fairing Ring'', ''SKU-7008'', ''$3,200.00 / unit'', ''Composite Shells • Unit: pcs • Cost: $980 • Status: Active'', %L, 7, ''System'', ''System'', ''MANUAL'', ''MANUAL'', NOW(), NOW())
    ', db_schema, prd1, sup1, prd2, sup3, prd3, sup1, prd4, sup2, prd5, sup4, prd6, sup1, prd7, sup7, prd8, sup8);

    -- C. Production Orders (opportunity)
    EXECUTE format('
        INSERT INTO %I.opportunity (
            id, name, "amountAmountMicros", "amountCurrencyCode", stage, "pointOfContactId", "companyId", "closeDate",
            position, "createdByName", "updatedByName", "createdBySource", "updatedBySource", "createdAt", "updatedAt"
        ) VALUES
            (%L, ''PO-8001: 500x Industrial Servo Motor V4 Assembly'', 45000000000, ''USD'', ''IN_PRODUCTION'', %L, %L, NOW() + INTERVAL ''5 days'', 0, ''System'', ''System'', ''MANUAL'', ''MANUAL'', NOW(), NOW()),
            (%L, ''PO-8002: 1200x Microprocessor Board SMT Batch'', 24000000000, ''USD'', ''QUALITY_CHECK'', %L, %L, NOW() + INTERVAL ''2 days'', 1, ''System'', ''System'', ''MANUAL'', ''MANUAL'', NOW(), NOW()),
            (%L, ''PO-8003: 150x Hydraulic Actuator Machining Run'', 32000000000, ''USD'', ''PLANNING'', %L, %L, NOW() + INTERVAL ''12 days'', 2, ''System'', ''System'', ''MANUAL'', ''MANUAL'', NOW(), NOW()),
            (%L, ''PO-8004: 300x Lithium Power Module Pack Assembly'', 58000000000, ''USD'', ''COMPLETED'', %L, %L, NOW() - INTERVAL ''1 day'', 3, ''System'', ''System'', ''MANUAL'', ''MANUAL'', NOW(), NOW()),
            (%L, ''PO-8005: 800x CNC Milled Chassis Stamping'', 16000000000, ''USD'', ''NEW_ORDER'', %L, %L, NOW() + INTERVAL ''18 days'', 4, ''System'', ''System'', ''MANUAL'', ''MANUAL'', NOW(), NOW()),
            (%L, ''PO-8006: 50x Turbine Impeller Aerodynamic Profiling'', 62500000000, ''USD'', ''IN_PRODUCTION'', %L, %L, NOW() + INTERVAL ''7 days'', 5, ''System'', ''System'', ''MANUAL'', ''MANUAL'', NOW(), NOW()),
            (%L, ''PO-8007: 2500x Vibration Sensor Calibration Lot'', 28500000000, ''USD'', ''PLANNING'', %L, %L, NOW() + INTERVAL ''14 days'', 6, ''System'', ''System'', ''MANUAL'', ''MANUAL'', NOW(), NOW()),
            (%L, ''PO-8008: 75x Carbon Fiber Fairing Ring Autoclave Cure'', 72000000000, ''USD'', ''QUALITY_CHECK'', %L, %L, NOW() + INTERVAL ''3 days'', 7, ''System'', ''System'', ''MANUAL'', ''MANUAL'', NOW(), NOW())
    ', db_schema, ord1, prd1, sup1, ord2, prd2, sup3, ord3, prd3, sup1, ord4, prd4, sup2, ord5, prd5, sup4, ord6, prd6, sup1, ord7, prd7, sup7, ord8, prd8, sup8);

    -- D. Raw Materials (task)
    EXECUTE format('
        INSERT INTO %I.task (
            id, title, "bodyV2Markdown", status, "dueAt",
            position, "createdByName", "updatedByName", "createdBySource", "updatedBySource", "createdAt", "updatedAt"
        ) VALUES
            (%L, ''MAT-9001: Grade 6061-T6 Aluminum Billets - Avail: 2,450 kg - Reorder: 500 kg - Cost: $85.50/kg'', ''2.5 Metric Tons of 6061-T6 extruded aluminum required for Chassis milling. Lot certified mill test reports attached in Bay A-12.'', ''IN_PROGRESS'', NOW() + INTERVAL ''4 days'', 0, ''System'', ''System'', ''MANUAL'', ''MANUAL'', NOW(), NOW()),
            (%L, ''MAT-9002: High-Purity Silicon Wafers 200mm - Avail: 500 units - Reorder: 200 units - Cost: $42.00/unit'', ''500 prime semiconductor wafers scheduled for robotic cleanroom pick-and-place run. Cleanroom level 100 protocol.'', ''TODO'', NOW() + INTERVAL ''7 days'', 1, ''System'', ''System'', ''MANUAL'', ''MANUAL'', NOW(), NOW()),
            (%L, ''MAT-9003: Copper Magnet Wire 18 AWG - Avail: 40 spools - Reorder: 10 spools - Cost: $19.50/spool'', ''40 spools copper magnet wire delivered and verified at incoming goods dock. Resistivity test passed.'', ''DONE'', NOW() - INTERVAL ''2 days'', 2, ''System'', ''System'', ''MANUAL'', ''MANUAL'', NOW(), NOW()),
            (%L, ''MAT-9004: Neodymium Rare-Earth Magnets N52 - Avail: 1,000 pcs - Reorder: 250 pcs - Cost: $28.75/pc'', ''1,000 N52 high-flux permanent magnets inspected on dock 3. Flux density measurement nominal.'', ''IN_PROGRESS'', NOW() + INTERVAL ''3 days'', 3, ''System'', ''System'', ''MANUAL'', ''MANUAL'', NOW(), NOW()),
            (%L, ''MAT-9005: Aerospace Grade 5 Titanium Bar (50mm) - Avail: 480 kg - Reorder: 150 kg - Cost: $115.00/kg'', ''Grade 5 AMS 4928 aerospace titanium bars. Certified tensile strength 950 MPa. Storage Bay A-12.'', ''IN_PROGRESS'', NOW() + INTERVAL ''6 days'', 4, ''System'', ''System'', ''MANUAL'', ''MANUAL'', NOW(), NOW()),
            (%L, ''MAT-9006: Hydraulic Valve Spool Castings - Avail: 620 pcs - Reorder: 120 pcs - Cost: $54.00/pc'', ''Ductile iron valve spool castings ready for precision CNC honing. Tolerance 0.002mm.'', ''TODO'', NOW() + INTERVAL ''9 days'', 5, ''System'', ''System'', ''MANUAL'', ''MANUAL'', NOW(), NOW()),
            (%L, ''MAT-9007: Automotive Lithium NMC Cathode Powder - Avail: 1,800 kg - Reorder: 400 kg - Cost: $38.00/kg'', ''1,800 kg battery-grade NMC 811 cathode powder. Dry room vault storage with dew point < -45°C.'', ''DONE'', NOW() - INTERVAL ''1 day'', 6, ''System'', ''System'', ''MANUAL'', ''MANUAL'', NOW(), NOW()),
            (%L, ''MAT-9008: Aerospace Toray T800 Carbon Prepreg - Avail: 350 m² - Reorder: 80 m² - Cost: $145.00/m²'', ''350 m² unidirectional carbon epoxy prepreg tape stored in Freezer Bay F-02 (-18°C). Out-time tracked.'', ''IN_PROGRESS'', NOW() + INTERVAL ''5 days'', 7, ''System'', ''System'', ''MANUAL'', ''MANUAL'', NOW(), NOW())
    ', db_schema, mat1, mat2, mat3, mat4, mat5, mat6, mat7, mat8);

    -- Task Targets
    EXECUTE format('
        INSERT INTO %I."taskTarget" (id, "taskId", "targetOpportunityId", "targetCompanyId", position, "createdAt", "updatedAt")
        VALUES
            (gen_random_uuid(), %L, %L, %L, 0, NOW(), NOW()),
            (gen_random_uuid(), %L, %L, %L, 0, NOW(), NOW()),
            (gen_random_uuid(), %L, %L, %L, 0, NOW(), NOW()),
            (gen_random_uuid(), %L, %L, %L, 0, NOW(), NOW()),
            (gen_random_uuid(), %L, %L, %L, 0, NOW(), NOW()),
            (gen_random_uuid(), %L, %L, %L, 0, NOW(), NOW()),
            (gen_random_uuid(), %L, %L, %L, 0, NOW(), NOW()),
            (gen_random_uuid(), %L, %L, %L, 0, NOW(), NOW())
    ', db_schema, mat1, ord5, sup4, mat2, ord2, sup3, mat3, ord1, sup1, mat4, ord1, sup4, mat5, ord6, sup1, mat6, ord3, sup1, mat7, ord4, sup2, mat8, ord8, sup8);

    -- E. Inventory (note)
    EXECUTE format('
        INSERT INTO %I.note (
            id, title, "bodyV2Markdown",
            position, "createdByName", "updatedByName", "createdBySource", "updatedBySource", "createdAt", "updatedAt"
        ) VALUES
            (%L, ''INV-101: Warehouse Bay A-12 - Finished Servo Motors (SKU-7001)'', ''Stock: 450 units boxed, barcode scanned, palletized and shrink-wrapped. Quality release tag #QR-994 attached. Ready for shipping dock allocation. Status: In Stock.'', 0, ''System'', ''System'', ''MANUAL'', ''MANUAL'', NOW(), NOW()),
            (%L, ''INV-102: Cold Room B - Silicon Wafers Cassettes (SKU-7002)'', ''Stock: 350 sealed nitrogen-flushed cassettes at 21°C controlled temperature and 40%%%% RH humidity. Lot tracked under wafer fab #WF-2026-X. Status: Optimal.'', 1, ''System'', ''System'', ''MANUAL'', ''MANUAL'', NOW(), NOW()),
            (%L, ''INV-103: Raw Material Yard C - Structural Aluminum Billets (MAT-9001)'', ''Stock: 12 metric tons stacked and weather-covered. Certified tensile strength 310 MPa. Allocated across Orders 8003 and 8005. Status: In Stock.'', 2, ''System'', ''System'', ''MANUAL'', ''MANUAL'', NOW(), NOW()),
            (%L, ''INV-104: High-Value Vault B - Microprocessor IC Units (MAT-9002)'', ''Stock: 2,400 IC units logged into ERP. Anti-static moisture barrier bags intact with humidity indicator cards at < 10%%%%. Status: Optimal.'', 3, ''System'', ''System'', ''MANUAL'', ''MANUAL'', NOW(), NOW()),
            (%L, ''INV-105: Warehouse Bay B-08 - Hydraulic Actuators (SKU-7003)'', ''Stock: 180 units ready for dispatch. Tested at 5,000 PSI with hydraulic fluid flushed. Status: In Stock.'', 4, ''System'', ''System'', ''MANUAL'', ''MANUAL'', NOW(), NOW()),
            (%L, ''INV-106: Packaging Staging Area - Lithium Power Packs (SKU-7004)'', ''Stock: 320 units UN 3480 certified packaging for dangerous goods transport. Status: Ready for Dispatch.'', 5, ''System'', ''System'', ''MANUAL'', ''MANUAL'', NOW(), NOW()),
            (%L, ''INV-107: Cleanroom Staging Area - MEMS Vibration Sensors (SKU-7007)'', ''Stock: 1,500 units pre-calibrated and tape-and-reel packaged. Lot inspection cert #QC-7007 attached. Status: In Stock.'', 6, ''System'', ''System'', ''MANUAL'', ''MANUAL'', NOW(), NOW()),
            (%L, ''INV-108: Freezer Vault F-02 - Carbon Fiber Prepreg Rolls (MAT-9008)'', ''Stock: 42 rolls at -18°C. Remaining out-time budget: 184 hours. Monitored by continuous IoT dataloggers. Status: Controlled Storage.'', 7, ''System'', ''System'', ''MANUAL'', ''MANUAL'', NOW(), NOW())
    ', db_schema, inv1, inv2, inv3, inv4, inv5, inv6, inv7, inv8);

    -- F. Quality Control (dashboard)
    EXECUTE format('
        INSERT INTO %I.dashboard (
            id, title,
            position, "createdByName", "updatedByName", "createdBySource", "updatedBySource", "createdAt", "updatedAt"
        ) VALUES
            (%L, ''QC-2026-01: First-Pass Yield (FPY) & Assembly Line Defect Analytics (98.4%%%% Compliance) - Result: PASSED - Defects: 0 - Inspector: Devon Ross'', 0, ''System'', ''System'', ''MANUAL'', ''MANUAL'', NOW(), NOW()),
            (%L, ''QC-2026-02: Incoming Raw Material Inspection & Supplier Non-Conformance Report (99.1%%%% Pass) - Result: PASSED - Defects: 0 - Inspector: Kavita Nair'', 1, ''System'', ''System'', ''MANUAL'', ''MANUAL'', NOW(), NOW()),
            (%L, ''QC-2026-03: Overall Equipment Effectiveness (OEE) & Machine Uptime Metrics (89.2%%%% Availability) - Status: OPTIMAL'', 2, ''System'', ''System'', ''MANUAL'', ''MANUAL'', NOW(), NOW()),
            (%L, ''QC-2026-04: Servo Actuator 350-Bar High Pressure Hydraulic Leak Test - Result: ZERO DEFECTS - Inspector: Devon Ross'', 3, ''System'', ''System'', ''MANUAL'', ''MANUAL'', NOW(), NOW()),
            (%L, ''QC-2026-05: Aerospace Titanium Ultrasonic Non-Destructive Flaw Detection - Result: 100%%%% CERTIFIED - Inspector: Liam Gallagher'', 4, ''System'', ''System'', ''MANUAL'', ''MANUAL'', NOW(), NOW()),
            (%L, ''QC-2026-06: Microprocessor High-Temperature Burn-In Stress Test (125°C) - Result: PASSED - Inspector: Kavita Nair'', 5, ''System'', ''System'', ''MANUAL'', ''MANUAL'', NOW(), NOW()),
            (%L, ''QC-2026-07: Lithium Battery Pack Thermal Dissipation & Cyclic Charge-Discharge Audit - Result: CERTIFIED - Inspector: Devon Ross'', 6, ''System'', ''System'', ''MANUAL'', ''MANUAL'', NOW(), NOW()),
            (%L, ''QC-2026-08: Carbon Fiber Autoclave Void Ratio Ultrasonic Scan (0.12%%%% Voids < 1%%%% Spec) - Result: APPROVED - Inspector: Dr. Sandra Patel'', 7, ''System'', ''System'', ''MANUAL'', ''MANUAL'', NOW(), NOW())
    ', db_schema, qc1, qc2, qc3, qc4, qc5, qc6, qc7, qc8);

    UPDATE core.workspace
    SET "metadataVersion" = "metadataVersion" + 1
    WHERE id = ws_id;

    RAISE NOTICE 'Manufacturing Seed Data applied successfully!';
END $$;
