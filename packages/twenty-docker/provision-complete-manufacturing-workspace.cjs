const { Client } = require('pg');
const { createClient } = require('redis');

const MODULE_PATH_BASE = '/app/packages/twenty-server/dist';

function getPgConnectionString() {
  return process.env.PG_DATABASE_URL || 'postgres://postgres:postgres@db:5432/default';
}

async function provisionManufacturingModules(app, targetWorkspaceId, options = {}) {
  const { isOnboardingTemplate = false } = options;

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
      throw new Error('No active target workspace found for Manufacturing CRM provisioning');
    }

    const ws = wsRes.rows[0];
    const wsId = ws.id;
    const schema = ws.databaseSchema;

    console.log('=========================================================================');
    console.log(`MANUFACTURING CRM PROVISIONER - Workspace: "${ws.displayName}" (${wsId}) [${schema}]`);
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
        // Ensure active and editable
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

      // Relabel built-in 'name' identifier field if requested
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
        console.log(`  [batch] Creating ${pendingScalarFields.length} scalar/select/currency/date fields in 1 migration...`);
        try {
          await fieldMetadataService.createManyFields({
            workspaceId: wsId,
            createFieldInputs: pendingScalarFields.map((f) => f.input),
          });
        } catch (e) {
          const details = e?.failedWorkspaceMigrationBuildResult?.report ? JSON.stringify(e.failedWorkspaceMigrationBuildResult.report) : e.message;
          throw new Error('Batch scalar fields failed: ' + details);
        }
        pendingScalarFields.length = 0;
      }
      if (pendingRelationFields.length > 0) {
        console.log(`  [batch] Creating ${pendingRelationFields.length} database-backed relation fields in 1 migration...`);
        try {
          await fieldMetadataService.createManyFields({
            workspaceId: wsId,
            createFieldInputs: pendingRelationFields.map((f) => f.input),
          });
        } catch (e) {
          const details = e?.failedWorkspaceMigrationBuildResult?.report ? JSON.stringify(e.failedWorkspaceMigrationBuildResult.report) : e.message;
          throw new Error('Batch relation fields failed: ' + details);
        }
        pendingRelationFields.length = 0;
      }
    };

    // =========================================================================
    // STEP 1: CREATE ALL 8 CUSTOM OBJECTS (6 CORE MODULES + 2 JUNCTION OBJECTS)
    // =========================================================================
    console.log('\n[1/5] Creating Manufacturing CRM custom objects...');

    const productObj = await ensureObject({
      nameSingular: 'product',
      namePlural: 'products',
      labelSingular: 'Product',
      labelPlural: 'Products',
      description: 'Manufactured products catalog',
      icon: 'IconPackage',
      color: 'blue',
      nameFieldLabel: 'Product Name',
      nameFieldDescription: 'Name of the manufactured product',
    });

    const supplierObj = await ensureObject({
      nameSingular: 'supplier',
      namePlural: 'suppliers',
      labelSingular: 'Supplier',
      labelPlural: 'Suppliers',
      description: 'Vendors who supply raw materials and components',
      icon: 'IconTruck',
      color: 'turquoise',
      nameFieldLabel: 'Supplier Name',
      nameFieldDescription: 'Name of the vendor / supplier',
    });

    const rawMaterialObj = await ensureObject({
      nameSingular: 'rawMaterial',
      namePlural: 'rawMaterials',
      labelSingular: 'Raw Material',
      labelPlural: 'Raw Materials',
      description: 'Raw materials and components needed for production',
      icon: 'IconCube',
      color: 'purple',
      nameFieldLabel: 'Material Name',
      nameFieldDescription: 'Name of the raw material',
    });

    const productionOrderObj = await ensureObject({
      nameSingular: 'productionOrder',
      namePlural: 'productionOrders',
      labelSingular: 'Production Order',
      labelPlural: 'Production Orders',
      description: 'Manufacturing jobs tracked from order to completion',
      icon: 'IconSettings',
      color: 'orange',
      nameFieldLabel: 'Order Number',
      nameFieldDescription: 'Unique auto-generated production order number (e.g. PO-1001)',
    });

    const inventoryObj = await ensureObject({
      nameSingular: 'inventoryItem',
      namePlural: 'inventoryItems',
      labelSingular: 'Inventory Item',
      labelPlural: 'Inventory',
      description: 'Stock tracking across warehouse locations for products and raw materials',
      icon: 'IconBuildingWarehouse',
      color: 'sky',
      nameFieldLabel: 'Inventory ID',
      nameFieldDescription: 'Unique auto-generated inventory record ID (e.g. INV-1001)',
    });

    const qualityControlObj = await ensureObject({
      nameSingular: 'qualityControl',
      namePlural: 'qualityControls',
      labelSingular: 'Quality Inspection',
      labelPlural: 'Quality Control',
      description: 'Quality inspections linked to production orders and products',
      icon: 'IconChecklist',
      color: 'green',
      nameFieldLabel: 'Inspection ID',
      nameFieldDescription: 'Unique auto-generated inspection number (e.g. QC-1001)',
    });

    const bomObj = await ensureObject({
      nameSingular: 'billOfMaterial',
      namePlural: 'billOfMaterials',
      labelSingular: 'BOM Item',
      labelPlural: 'Bill of Materials',
      description: 'Bill of Materials mapping Products to required Raw Materials and quantities',
      icon: 'IconListTree',
      color: 'amber',
      nameFieldLabel: 'BOM Reference',
      nameFieldDescription: 'Auto-generated BOM line reference (e.g. BOM-1001)',
    });

    const supplierMaterialObj = await ensureObject({
      nameSingular: 'supplierMaterial',
      namePlural: 'supplierMaterials',
      labelSingular: 'Supplier Material',
      labelPlural: 'Supplier Materials',
      description: 'Many-to-many link supporting multiple suppliers per raw material with lead time and pricing',
      icon: 'IconLink',
      color: 'cyan',
      nameFieldLabel: 'Link Code',
      nameFieldDescription: 'Auto-generated supplier-material reference (e.g. SM-1001)',
    });

    const memberObj = await getObjectByName('workspaceMember');

    // =========================================================================
    // STEP 2: CREATE ALL EXACT FIELDS & DATABASE-BACKED RELATIONSHIPS
    // =========================================================================
    console.log('\n[2/5] Creating fields and database-backed relationships...');

    // --- 1. PRODUCTS ---
    await ensureField(productObj.id, 'product', {
      name: 'productCode',
      label: 'Product Code / SKU',
      type: 'TEXT',
      icon: 'IconBarcode',
      description: 'Unique product SKU / code',
      isUnique: true,
    });
    await ensureField(productObj.id, 'product', {
      name: 'category',
      label: 'Category',
      type: 'SELECT',
      icon: 'IconCategory',
      description: 'Product category',
      options: [
        { value: 'ELECTRONICS', label: 'Electronics', color: 'blue', position: 0 },
        { value: 'MECHANICAL', label: 'Mechanical', color: 'orange', position: 1 },
        { value: 'HYDRAULIC', label: 'Hydraulic', color: 'turquoise', position: 2 },
        { value: 'STRUCTURAL', label: 'Structural', color: 'gray', position: 3 },
        { value: 'ENERGY_POWER', label: 'Energy & Power', color: 'green', position: 4 },
        { value: 'AUTOMATION', label: 'Automation', color: 'purple', position: 5 },
        { value: 'COMPOSITES', label: 'Composites', color: 'amber', position: 6 },
        { value: 'OTHER', label: 'Other', color: 'sky', position: 7 },
      ],
    });
    await ensureField(productObj.id, 'product', {
      name: 'unitOfMeasure',
      label: 'Unit of Measure',
      type: 'SELECT',
      icon: 'IconRuler',
      description: 'Unit of measure for finished product',
      options: [
        { value: 'PCS', label: 'Pieces (pcs)', color: 'blue', position: 0 },
        { value: 'KG', label: 'Kilograms (kg)', color: 'green', position: 1 },
        { value: 'M', label: 'Meters (m)', color: 'purple', position: 2 },
        { value: 'L', label: 'Liters (L)', color: 'sky', position: 3 },
        { value: 'SET', label: 'Sets', color: 'orange', position: 4 },
        { value: 'BOX', label: 'Boxes', color: 'amber', position: 5 },
        { value: 'UNIT', label: 'Units', color: 'cyan', position: 6 },
      ],
    });
    await ensureField(productObj.id, 'product', {
      name: 'standardCost',
      label: 'Standard Cost',
      type: 'CURRENCY',
      icon: 'IconCoin',
      description: 'Standard manufacturing cost per unit',
    });
    await ensureField(productObj.id, 'product', {
      name: 'sellingPrice',
      label: 'Selling Price',
      type: 'CURRENCY',
      icon: 'IconCurrencyDollar',
      description: 'Standard selling price per unit',
    });
    await ensureField(productObj.id, 'product', {
      name: 'description',
      label: 'Description',
      type: 'TEXT',
      icon: 'IconFileDescription',
      description: 'Detailed product specification and notes',
    });
    await ensureField(productObj.id, 'product', {
      name: 'status',
      label: 'Status',
      type: 'SELECT',
      icon: 'IconProgressCheck',
      description: 'Product lifecycle status',
      options: [
        { value: 'ACTIVE', label: 'Active', color: 'green', position: 0 },
        { value: 'INACTIVE', label: 'Inactive', color: 'gray', position: 1 },
      ],
    });

    // --- 2. SUPPLIERS ---
    await ensureField(supplierObj.id, 'supplier', {
      name: 'supplierCode',
      label: 'Supplier Code',
      type: 'TEXT',
      icon: 'IconHash',
      description: 'Unique vendor / supplier code',
      isUnique: true,
    });
    await ensureField(supplierObj.id, 'supplier', {
      name: 'contactPerson',
      label: 'Contact Person',
      type: 'TEXT',
      icon: 'IconUser',
      description: 'Primary point of contact at supplier',
    });
    await ensureField(supplierObj.id, 'supplier', {
      name: 'phone',
      label: 'Phone',
      type: 'PHONES',
      icon: 'IconPhone',
      description: 'Supplier phone number',
    });
    await ensureField(supplierObj.id, 'supplier', {
      name: 'email',
      label: 'Email',
      type: 'EMAILS',
      icon: 'IconMail',
      description: 'Supplier email address',
    });
    await ensureField(supplierObj.id, 'supplier', {
      name: 'supplierAddress',
      label: 'Address',
      type: 'TEXT',
      icon: 'IconMapPin',
      description: 'Full supplier street and shipping address',
    });
    await ensureField(supplierObj.id, 'supplier', {
      name: 'paymentTerms',
      label: 'Payment Terms',
      type: 'SELECT',
      icon: 'IconReceipt',
      description: 'Agreed supplier payment terms',
      options: [
        { value: 'NET_15', label: 'Net 15', color: 'sky', position: 0 },
        { value: 'NET_30', label: 'Net 30', color: 'blue', position: 1 },
        { value: 'NET_45', label: 'Net 45', color: 'purple', position: 2 },
        { value: 'NET_60', label: 'Net 60', color: 'orange', position: 3 },
        { value: 'DUE_ON_RECEIPT', label: 'Due on Receipt', color: 'green', position: 4 },
        { value: 'ADVANCE', label: 'Advance Payment', color: 'amber', position: 5 },
      ],
    });
    const supplierApprovalStageField = await ensureField(supplierObj.id, 'supplier', {
      name: 'approvalStage',
      label: 'Approval Stage',
      type: 'SELECT',
      icon: 'IconChecklist',
      description: 'Supplier qualification and approval pipeline stage',
      options: [
        { value: 'PROSPECT', label: 'Prospect', color: 'sky', position: 0 },
        { value: 'UNDER_REVIEW', label: 'Under Review', color: 'purple', position: 1 },
        { value: 'AUDIT', label: 'Quality Audit', color: 'yellow', position: 2 },
        { value: 'APPROVED', label: 'Approved', color: 'green', position: 3 },
        { value: 'PREFERRED', label: 'Preferred', color: 'turquoise', position: 4 },
        { value: 'SUSPENDED', label: 'Suspended', color: 'red', position: 5 },
      ],
    });
    await ensureField(supplierObj.id, 'supplier', {
      name: 'status',
      label: 'Status',
      type: 'SELECT',
      icon: 'IconProgressCheck',
      description: 'Supplier active/inactive status',
      options: [
        { value: 'ACTIVE', label: 'Active', color: 'green', position: 0 },
        { value: 'INACTIVE', label: 'Inactive', color: 'gray', position: 1 },
      ],
    });

    // --- 3. RAW MATERIALS ---
    await ensureField(rawMaterialObj.id, 'rawMaterial', {
      name: 'materialCode',
      label: 'Material Code',
      type: 'TEXT',
      icon: 'IconBarcode',
      description: 'Unique raw material code',
      isUnique: true,
    });
    await ensureField(rawMaterialObj.id, 'rawMaterial', {
      name: 'category',
      label: 'Category',
      type: 'SELECT',
      icon: 'IconCategory',
      description: 'Raw material category',
      options: [
        { value: 'METALS_ALLOYS', label: 'Metals & Alloys', color: 'blue', position: 0 },
        { value: 'POLYMERS_CHEMICALS', label: 'Polymers & Chemicals', color: 'purple', position: 1 },
        { value: 'SEMICONDUCTORS', label: 'Semiconductors & ICs', color: 'turquoise', position: 2 },
        { value: 'FASTENERS_HARDWARE', label: 'Fasteners & Hardware', color: 'orange', position: 3 },
        { value: 'COMPOSITES', label: 'Composites', color: 'amber', position: 4 },
        { value: 'ELECTRICAL', label: 'Electrical & Wire', color: 'yellow', position: 5 },
        { value: 'PACKAGING', label: 'Packaging', color: 'green', position: 6 },
        { value: 'OTHER', label: 'Other', color: 'gray', position: 7 },
      ],
    });
    await ensureField(rawMaterialObj.id, 'rawMaterial', {
      name: 'unitOfMeasure',
      label: 'Unit of Measure',
      type: 'SELECT',
      icon: 'IconRuler',
      description: 'Measurement unit for raw material',
      options: [
        { value: 'KG', label: 'Kilograms (kg)', color: 'blue', position: 0 },
        { value: 'G', label: 'Grams (g)', color: 'sky', position: 1 },
        { value: 'M', label: 'Meters (m)', color: 'purple', position: 2 },
        { value: 'SQM', label: 'Square Meters (m²)', color: 'turquoise', position: 3 },
        { value: 'L', label: 'Liters (L)', color: 'green', position: 4 },
        { value: 'PCS', label: 'Pieces (pcs)', color: 'orange', position: 5 },
        { value: 'SPOOL', label: 'Spools', color: 'amber', position: 6 },
        { value: 'ROLL', label: 'Rolls', color: 'cyan', position: 7 },
        { value: 'UNIT', label: 'Units', color: 'gray', position: 8 },
      ],
    });
    await ensureField(rawMaterialObj.id, 'rawMaterial', {
      name: 'availableQuantity',
      label: 'Available Quantity',
      type: 'NUMBER',
      icon: 'IconNumbers',
      description: 'Current available raw material quantity (non-negative)',
    });
    await ensureField(rawMaterialObj.id, 'rawMaterial', {
      name: 'reorderLevel',
      label: 'Reorder Level',
      type: 'NUMBER',
      icon: 'IconAlertTriangle',
      description: 'Threshold quantity that triggers Low Stock status (non-negative)',
    });
    await ensureField(rawMaterialObj.id, 'rawMaterial', {
      name: 'unitCost',
      label: 'Unit Cost',
      type: 'CURRENCY',
      icon: 'IconCoin',
      description: 'Standard purchase cost per unit of material',
    });
    await ensureField(rawMaterialObj.id, 'rawMaterial', {
      name: 'primarySupplier',
      label: 'Primary Supplier',
      type: 'RELATION',
      icon: 'IconTruck',
      description: 'Primary vendor supplying this raw material',
      relationCreationPayload: {
        type: 'MANY_TO_ONE',
        targetObjectMetadataId: supplierObj.id,
        targetFieldLabel: 'Primary Supplied Materials',
        targetFieldIcon: 'IconCube',
      },
    });
    await ensureField(rawMaterialObj.id, 'rawMaterial', {
      name: 'storageLocation',
      label: 'Storage Location',
      type: 'TEXT',
      icon: 'IconMapPin',
      description: 'Default warehouse bay or rack location',
    });
    await ensureField(rawMaterialObj.id, 'rawMaterial', {
      name: 'status',
      label: 'Status',
      type: 'SELECT',
      icon: 'IconProgressCheck',
      description: 'Auto-calculated stock availability status (Available / Low Stock / Out of Stock)',
      options: [
        { value: 'AVAILABLE', label: 'Available', color: 'green', position: 0 },
        { value: 'LOW_STOCK', label: 'Low Stock', color: 'orange', position: 1 },
        { value: 'OUT_OF_STOCK', label: 'Out of Stock', color: 'red', position: 2 },
      ],
    });

    // --- 4. PRODUCTION ORDERS ---
    await ensureField(productionOrderObj.id, 'productionOrder', {
      name: 'product',
      label: 'Product',
      type: 'RELATION',
      icon: 'IconPackage',
      description: 'Product being manufactured in this order',
      relationCreationPayload: {
        type: 'MANY_TO_ONE',
        targetObjectMetadataId: productObj.id,
        targetFieldLabel: 'Production Orders',
        targetFieldIcon: 'IconSettings',
      },
    });
    await ensureField(productionOrderObj.id, 'productionOrder', {
      name: 'plannedQuantity',
      label: 'Planned Quantity',
      type: 'NUMBER',
      icon: 'IconNumbers',
      description: 'Target quantity planned for production (non-negative)',
    });
    await ensureField(productionOrderObj.id, 'productionOrder', {
      name: 'producedQuantity',
      label: 'Produced Quantity',
      type: 'NUMBER',
      icon: 'IconCheck',
      description: 'Actual quantity produced so far (non-negative)',
    });
    await ensureField(productionOrderObj.id, 'productionOrder', {
      name: 'startDate',
      label: 'Start Date',
      type: 'DATE',
      icon: 'IconCalendar',
      description: 'Scheduled or actual start date',
    });
    await ensureField(productionOrderObj.id, 'productionOrder', {
      name: 'dueDate',
      label: 'Due Date',
      type: 'DATE',
      icon: 'IconCalendarDue',
      description: 'Target completion due date',
    });
    await ensureField(productionOrderObj.id, 'productionOrder', {
      name: 'actualCompletionDate',
      label: 'Actual Completion Date',
      type: 'DATE',
      icon: 'IconCalendarCheck',
      description: 'Date production order was actually completed',
    });
    await ensureField(productionOrderObj.id, 'productionOrder', {
      name: 'assignedTeam',
      label: 'Assigned Team',
      type: 'TEXT',
      icon: 'IconUsers',
      description: 'Manufacturing shift or production line team',
    });
    if (memberObj) {
      await ensureField(productionOrderObj.id, 'productionOrder', {
        name: 'assignedLead',
        label: 'Assigned Supervisor',
        type: 'RELATION',
        icon: 'IconUserCheck',
        description: 'Workspace member supervising this production order',
        relationCreationPayload: {
          type: 'MANY_TO_ONE',
          targetObjectMetadataId: memberObj.id,
          targetFieldLabel: 'Production Orders',
          targetFieldIcon: 'IconSettings',
        },
      });
    }
    const productionStageField = await ensureField(productionOrderObj.id, 'productionOrder', {
      name: 'stage',
      label: 'Stage',
      type: 'SELECT',
      icon: 'IconProgressCheck',
      description: 'Manufacturing pipeline stage',
      options: [
        { value: 'NEW_ORDER', label: 'New Order', color: 'sky', position: 0 },
        { value: 'PLANNING', label: 'Planning', color: 'purple', position: 1 },
        { value: 'IN_PRODUCTION', label: 'In Production', color: 'yellow', position: 2 },
        { value: 'QUALITY_CHECK', label: 'Quality Check', color: 'turquoise', position: 3 },
        { value: 'COMPLETED', label: 'Completed', color: 'green', position: 4 },
        { value: 'CANCELLED', label: 'Cancelled', color: 'red', position: 5 },
      ],
    });
    await ensureField(productionOrderObj.id, 'productionOrder', {
      name: 'priority',
      label: 'Priority',
      type: 'SELECT',
      icon: 'IconFlag',
      description: 'Production priority (Low / Medium / High)',
      options: [
        { value: 'LOW', label: 'Low', color: 'sky', position: 0 },
        { value: 'MEDIUM', label: 'Medium', color: 'orange', position: 1 },
        { value: 'HIGH', label: 'High', color: 'red', position: 2 },
      ],
    });
    await ensureField(productionOrderObj.id, 'productionOrder', {
      name: 'notes',
      label: 'Notes',
      type: 'TEXT',
      icon: 'IconNotes',
      description: 'Shop floor instructions, batch notes, and remarks',
    });

    // --- 5. INVENTORY ---
    await ensureField(inventoryObj.id, 'inventoryItem', {
      name: 'itemType',
      label: 'Item Type',
      type: 'SELECT',
      icon: 'IconTag',
      description: 'Whether this stock record tracks a Product or a Raw Material',
      options: [
        { value: 'PRODUCT', label: 'Product', color: 'blue', position: 0 },
        { value: 'RAW_MATERIAL', label: 'Raw Material', color: 'purple', position: 1 },
      ],
    });
    await ensureField(inventoryObj.id, 'inventoryItem', {
      name: 'product',
      label: 'Product',
      type: 'RELATION',
      icon: 'IconPackage',
      description: 'Optional relation to Product when Item Type is Product',
      relationCreationPayload: {
        type: 'MANY_TO_ONE',
        targetObjectMetadataId: productObj.id,
        targetFieldLabel: 'Inventory Stock',
        targetFieldIcon: 'IconBuildingWarehouse',
      },
    });
    await ensureField(inventoryObj.id, 'inventoryItem', {
      name: 'rawMaterial',
      label: 'Raw Material',
      type: 'RELATION',
      icon: 'IconCube',
      description: 'Optional relation to Raw Material when Item Type is Raw Material',
      relationCreationPayload: {
        type: 'MANY_TO_ONE',
        targetObjectMetadataId: rawMaterialObj.id,
        targetFieldLabel: 'Inventory Stock',
        targetFieldIcon: 'IconBuildingWarehouse',
      },
    });
    await ensureField(inventoryObj.id, 'inventoryItem', {
      name: 'warehouseLocation',
      label: 'Warehouse / Location',
      type: 'TEXT',
      icon: 'IconMapPin',
      description: 'Warehouse, bay, bin, or storage location',
    });
    await ensureField(inventoryObj.id, 'inventoryItem', {
      name: 'quantityOnHand',
      label: 'Quantity on Hand',
      type: 'NUMBER',
      icon: 'IconNumbers',
      description: 'Physical stock currently on hand (non-negative)',
    });
    await ensureField(inventoryObj.id, 'inventoryItem', {
      name: 'reservedQuantity',
      label: 'Reserved Quantity',
      type: 'NUMBER',
      icon: 'IconLock',
      description: 'Quantity reserved for active orders (non-negative)',
    });
    await ensureField(inventoryObj.id, 'inventoryItem', {
      name: 'reorderLevel',
      label: 'Reorder Level',
      type: 'NUMBER',
      icon: 'IconAlertTriangle',
      description: 'Warehouse reorder threshold (optional; falls back to linked Raw Material reorder level)',
    });
    await ensureField(inventoryObj.id, 'inventoryItem', {
      name: 'availableQuantity',
      label: 'Available Quantity',
      type: 'NUMBER',
      icon: 'IconCalculator',
      description: 'Calculated automatically: Quantity on Hand minus Reserved Quantity',
    });
    await ensureField(inventoryObj.id, 'inventoryItem', {
      name: 'isLowStock',
      label: 'Low Stock Flag',
      type: 'BOOLEAN',
      icon: 'IconBell',
      description: 'Automatically flagged true when Available Quantity reaches or falls below Reorder Level',
    });
    await ensureField(inventoryObj.id, 'inventoryItem', {
      name: 'lastUpdated',
      label: 'Last Updated',
      type: 'DATE_TIME',
      icon: 'IconClock',
      description: 'Automatically recorded timestamp of last inventory update',
    });
    await ensureField(inventoryObj.id, 'inventoryItem', {
      name: 'stockStatus',
      label: 'Stock Status',
      type: 'SELECT',
      icon: 'IconProgressCheck',
      description: 'Calculated stock status: In Stock / Low Stock / Out of Stock',
      options: [
        { value: 'IN_STOCK', label: 'In Stock', color: 'green', position: 0 },
        { value: 'LOW_STOCK', label: 'Low Stock', color: 'orange', position: 1 },
        { value: 'OUT_OF_STOCK', label: 'Out of Stock', color: 'red', position: 2 },
      ],
    });

    // --- 6. QUALITY CONTROL ---
    await ensureField(qualityControlObj.id, 'qualityControl', {
      name: 'productionOrder',
      label: 'Production Order',
      type: 'RELATION',
      icon: 'IconSettings',
      description: 'Production order being inspected (one order can have multiple inspections)',
      relationCreationPayload: {
        type: 'MANY_TO_ONE',
        targetObjectMetadataId: productionOrderObj.id,
        targetFieldLabel: 'Quality Inspections',
        targetFieldIcon: 'IconChecklist',
      },
    });
    await ensureField(qualityControlObj.id, 'qualityControl', {
      name: 'product',
      label: 'Product',
      type: 'RELATION',
      icon: 'IconPackage',
      description: 'Product being inspected',
      relationCreationPayload: {
        type: 'MANY_TO_ONE',
        targetObjectMetadataId: productObj.id,
        targetFieldLabel: 'Quality Inspections',
        targetFieldIcon: 'IconChecklist',
      },
    });
    await ensureField(qualityControlObj.id, 'qualityControl', {
      name: 'inspectionDate',
      label: 'Inspection Date',
      type: 'DATE',
      icon: 'IconCalendar',
      description: 'Date quality inspection was conducted',
    });
    await ensureField(qualityControlObj.id, 'qualityControl', {
      name: 'inspectorName',
      label: 'Inspector',
      type: 'TEXT',
      icon: 'IconUserCheck',
      description: 'Name of the QA/QC inspector',
    });
    if (memberObj) {
      await ensureField(qualityControlObj.id, 'qualityControl', {
        name: 'inspectorUser',
        label: 'Inspector User',
        type: 'RELATION',
        icon: 'IconUser',
        description: 'Workspace user who performed the inspection',
        relationCreationPayload: {
          type: 'MANY_TO_ONE',
          targetObjectMetadataId: memberObj.id,
          targetFieldLabel: 'Quality Inspections',
          targetFieldIcon: 'IconChecklist',
        },
      });
    }
    await ensureField(qualityControlObj.id, 'qualityControl', {
      name: 'quantityInspected',
      label: 'Quantity Inspected',
      type: 'NUMBER',
      icon: 'IconSearch',
      description: 'Total units inspected (non-negative)',
    });
    await ensureField(qualityControlObj.id, 'qualityControl', {
      name: 'quantityPassed',
      label: 'Quantity Passed',
      type: 'NUMBER',
      icon: 'IconCircleCheck',
      description: 'Units that passed inspection (Passed + Failed <= Inspected)',
    });
    await ensureField(qualityControlObj.id, 'qualityControl', {
      name: 'quantityFailed',
      label: 'Quantity Failed',
      type: 'NUMBER',
      icon: 'IconCircleX',
      description: 'Units that failed inspection (Passed + Failed <= Inspected)',
    });
    await ensureField(qualityControlObj.id, 'qualityControl', {
      name: 'passRate',
      label: 'Pass Rate (%)',
      type: 'NUMBER',
      icon: 'IconPercentage',
      description: 'Auto-calculated percentage of inspected units that passed',
    });
    await ensureField(qualityControlObj.id, 'qualityControl', {
      name: 'result',
      label: 'Inspection Result',
      type: 'SELECT',
      icon: 'IconChecklist',
      description: 'Overall inspection outcome',
      options: [
        { value: 'PENDING', label: 'Pending', color: 'sky', position: 0 },
        { value: 'PASSED', label: 'Passed', color: 'green', position: 1 },
        { value: 'CONDITIONAL', label: 'Conditional', color: 'orange', position: 2 },
        { value: 'FAILED', label: 'Failed', color: 'red', position: 3 },
      ],
    });
    await ensureField(qualityControlObj.id, 'qualityControl', {
      name: 'defectNotes',
      label: 'Defect / Inspection Notes',
      type: 'TEXT',
      icon: 'IconNotes',
      description: 'Detailed inspection findings, root causes, and corrective actions',
    });

    // --- 7. BILL OF MATERIALS (Products <-> Raw Materials many-to-many junction) ---
    await ensureField(bomObj.id, 'billOfMaterial', {
      name: 'product',
      label: 'Product',
      type: 'RELATION',
      icon: 'IconPackage',
      description: 'Finished product in the Bill of Materials',
      relationCreationPayload: {
        type: 'MANY_TO_ONE',
        targetObjectMetadataId: productObj.id,
        targetFieldLabel: 'Bill of Materials',
        targetFieldIcon: 'IconListTree',
      },
    });
    await ensureField(bomObj.id, 'billOfMaterial', {
      name: 'rawMaterial',
      label: 'Raw Material',
      type: 'RELATION',
      icon: 'IconCube',
      description: 'Required raw material for this product',
      relationCreationPayload: {
        type: 'MANY_TO_ONE',
        targetObjectMetadataId: rawMaterialObj.id,
        targetFieldLabel: 'Used in BOMs',
        targetFieldIcon: 'IconListTree',
      },
    });
    await ensureField(bomObj.id, 'billOfMaterial', {
      name: 'quantityRequired',
      label: 'Quantity Required',
      type: 'NUMBER',
      icon: 'IconNumbers',
      description: 'Quantity of raw material required per unit of product (non-negative)',
    });
    await ensureField(bomObj.id, 'billOfMaterial', {
      name: 'unitOfMeasure',
      label: 'Unit of Measure',
      type: 'SELECT',
      icon: 'IconRuler',
      description: 'Unit of measure for required quantity',
      options: [
        { value: 'PCS', label: 'Pieces (pcs)', color: 'blue', position: 0 },
        { value: 'KG', label: 'Kilograms (kg)', color: 'green', position: 1 },
        { value: 'G', label: 'Grams (g)', color: 'sky', position: 2 },
        { value: 'M', label: 'Meters (m)', color: 'purple', position: 3 },
        { value: 'SQM', label: 'Square Meters (m²)', color: 'turquoise', position: 4 },
        { value: 'L', label: 'Liters (L)', color: 'orange', position: 5 },
        { value: 'UNIT', label: 'Units', color: 'gray', position: 6 },
      ],
    });
    await ensureField(bomObj.id, 'billOfMaterial', {
      name: 'scrapFactorPercent',
      label: 'Scrap Factor (%)',
      type: 'NUMBER',
      icon: 'IconPercentage',
      description: 'Expected material waste percentage (non-negative)',
    });
    await ensureField(bomObj.id, 'billOfMaterial', {
      name: 'notes',
      label: 'Notes',
      type: 'TEXT',
      icon: 'IconNotes',
      description: 'BOM assembly instructions or substitution notes',
    });

    // --- 8. SUPPLIER MATERIALS (Suppliers <-> Raw Materials many-to-many junction) ---
    await ensureField(supplierMaterialObj.id, 'supplierMaterial', {
      name: 'supplier',
      label: 'Supplier',
      type: 'RELATION',
      icon: 'IconTruck',
      description: 'Vendor supplying this raw material',
      relationCreationPayload: {
        type: 'MANY_TO_ONE',
        targetObjectMetadataId: supplierObj.id,
        targetFieldLabel: 'Supplied Materials',
        targetFieldIcon: 'IconCube',
      },
    });
    await ensureField(supplierMaterialObj.id, 'supplierMaterial', {
      name: 'rawMaterial',
      label: 'Raw Material',
      type: 'RELATION',
      icon: 'IconCube',
      description: 'Raw material supplied by this vendor',
      relationCreationPayload: {
        type: 'MANY_TO_ONE',
        targetObjectMetadataId: rawMaterialObj.id,
        targetFieldLabel: 'Suppliers',
        targetFieldIcon: 'IconTruck',
      },
    });
    await ensureField(supplierMaterialObj.id, 'supplierMaterial', {
      name: 'unitPrice',
      label: 'Quoted Unit Price',
      type: 'CURRENCY',
      icon: 'IconCoin',
      description: 'Supplier-specific unit price for this material',
    });
    await ensureField(supplierMaterialObj.id, 'supplierMaterial', {
      name: 'leadTimeDays',
      label: 'Lead Time (Days)',
      type: 'NUMBER',
      icon: 'IconClock',
      description: 'Typical delivery lead time in days (non-negative)',
    });
    await ensureField(supplierMaterialObj.id, 'supplierMaterial', {
      name: 'minimumOrderQuantity',
      label: 'Min Order Qty',
      type: 'NUMBER',
      icon: 'IconNumbers',
      description: 'Minimum order quantity required by supplier (non-negative)',
    });
    await ensureField(supplierMaterialObj.id, 'supplierMaterial', {
      name: 'isPreferred',
      label: 'Preferred Supplier',
      type: 'BOOLEAN',
      icon: 'IconStar',
      description: 'Marks this supplier as preferred for this material',
    });

    await flushPendingFields();

    const resolvedSupplierApprovalStageField = await getFieldByName(supplierObj.id, 'approvalStage');
    const resolvedProductionStageField = await getFieldByName(productionOrderObj.id, 'stage');

    // =========================================================================
    // STEP 3: DATABASE SEQUENCES, UNIQUE INDEXES, CALCULATIONS & VALIDATIONS
    // =========================================================================
    console.log('\n[3/5] Installing safe PostgreSQL sequences, unique indexes, calculations & validation triggers...');

    // Verify exact table names created by Twenty for custom objects (usually _product, _supplier, etc.)
    const tableMap = {};
    for (const nameSingular of [
      'product',
      'supplier',
      'rawMaterial',
      'productionOrder',
      'inventoryItem',
      'qualityControl',
      'billOfMaterial',
      'supplierMaterial',
    ]) {
      const obj = await getObjectByName(nameSingular);
      // Inspect actual table in workspace schema (Twenty names custom tables `_<nameSingular>` or `<nameSingular>`)
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

    const tProd = `"${tableMap.product}"`;
    const tSup = `"${tableMap.supplier}"`;
    const tMat = `"${tableMap.rawMaterial}"`;
    const tPO = `"${tableMap.productionOrder}"`;
    const tInv = `"${tableMap.inventoryItem}"`;
    const tQC = `"${tableMap.qualityControl}"`;
    const tBOM = `"${tableMap.billOfMaterial}"`;
    const tSM = `"${tableMap.supplierMaterial}"`;

    await c.query(`
      -- Sequences for auto-generated unique codes
      CREATE SEQUENCE IF NOT EXISTS ${schema}.mfg_po_seq START WITH 1001;
      CREATE SEQUENCE IF NOT EXISTS ${schema}.mfg_inv_seq START WITH 1001;
      CREATE SEQUENCE IF NOT EXISTS ${schema}.mfg_qc_seq START WITH 1001;
      CREATE SEQUENCE IF NOT EXISTS ${schema}.mfg_bom_seq START WITH 1001;
      CREATE SEQUENCE IF NOT EXISTS ${schema}.mfg_sm_seq START WITH 1001;

      -- Unique partial indexes for auto-generated unique identifiers
      CREATE UNIQUE INDEX IF NOT EXISTS idx_mfg_po_order_number_uniq
        ON ${schema}.${tPO} (name) WHERE "deletedAt" IS NULL AND name IS NOT NULL AND name <> '';
      CREATE UNIQUE INDEX IF NOT EXISTS idx_mfg_inv_id_uniq
        ON ${schema}.${tInv} (name) WHERE "deletedAt" IS NULL AND name IS NOT NULL AND name <> '';
      CREATE UNIQUE INDEX IF NOT EXISTS idx_mfg_qc_id_uniq
        ON ${schema}.${tQC} (name) WHERE "deletedAt" IS NULL AND name IS NOT NULL AND name <> '';

      -- 1. Production Orders trigger: auto-generate Order Number + validate non-negative quantities + defaults
      CREATE OR REPLACE FUNCTION ${schema}.mfg_production_order_before_write()
      RETURNS TRIGGER AS $$
      BEGIN
        IF NEW.name IS NULL OR BTRIM(NEW.name) = '' THEN
          NEW.name := 'PO-' || nextval('${schema}.mfg_po_seq');
        END IF;

        IF NEW."plannedQuantity" IS NOT NULL AND NEW."plannedQuantity" < 0 THEN
          RAISE EXCEPTION 'Planned Quantity must be non-negative' USING ERRCODE = '23514';
        END IF;

        IF NEW."producedQuantity" IS NOT NULL AND NEW."producedQuantity" < 0 THEN
          RAISE EXCEPTION 'Produced Quantity must be non-negative' USING ERRCODE = '23514';
        END IF;

        IF NEW.stage IS NULL THEN
          NEW.stage := 'NEW_ORDER';
        END IF;

        IF NEW.priority IS NULL THEN
          NEW.priority := 'MEDIUM';
        END IF;

        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;

      DROP TRIGGER IF EXISTS trg_mfg_production_order_before_write ON ${schema}.${tPO};
      CREATE TRIGGER trg_mfg_production_order_before_write
      BEFORE INSERT OR UPDATE ON ${schema}.${tPO}
      FOR EACH ROW EXECUTE FUNCTION ${schema}.mfg_production_order_before_write();

      -- 2. Raw Materials trigger: validate non-negative quantities + auto-compute Low Stock / Out of Stock status
      CREATE OR REPLACE FUNCTION ${schema}.mfg_raw_material_before_write()
      RETURNS TRIGGER AS $$
      DECLARE
        v_avail numeric;
        v_reorder numeric;
      BEGIN
        IF NEW."availableQuantity" IS NOT NULL AND NEW."availableQuantity" < 0 THEN
          RAISE EXCEPTION 'Raw Material Available Quantity must be non-negative' USING ERRCODE = '23514';
        END IF;

        IF NEW."reorderLevel" IS NOT NULL AND NEW."reorderLevel" < 0 THEN
          RAISE EXCEPTION 'Raw Material Reorder Level must be non-negative' USING ERRCODE = '23514';
        END IF;

        v_avail := COALESCE(NEW."availableQuantity", 0);
        v_reorder := COALESCE(NEW."reorderLevel", 0);

        IF v_avail <= 0 THEN
          NEW.status := 'OUT_OF_STOCK';
        ELSIF v_avail <= v_reorder THEN
          NEW.status := 'LOW_STOCK';
        ELSE
          NEW.status := 'AVAILABLE';
        END IF;

        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;

      DROP TRIGGER IF EXISTS trg_mfg_raw_material_before_write ON ${schema}.${tMat};
      CREATE TRIGGER trg_mfg_raw_material_before_write
      BEFORE INSERT OR UPDATE ON ${schema}.${tMat}
      FOR EACH ROW EXECUTE FUNCTION ${schema}.mfg_raw_material_before_write();

      -- 3. Inventory trigger: auto-ID, non-negative check, Available = On Hand - Reserved, Low Stock Flag, Stock Status, Last Updated
      CREATE OR REPLACE FUNCTION ${schema}.mfg_inventory_before_write()
      RETURNS TRIGGER AS $$
      DECLARE
        v_on_hand numeric;
        v_reserved numeric;
        v_available numeric;
        v_reorder numeric;
      BEGIN
        IF NEW.name IS NULL OR BTRIM(NEW.name) = '' THEN
          NEW.name := 'INV-' || nextval('${schema}.mfg_inv_seq');
        END IF;

        IF NEW."quantityOnHand" IS NOT NULL AND NEW."quantityOnHand" < 0 THEN
          RAISE EXCEPTION 'Quantity on Hand must be non-negative' USING ERRCODE = '23514';
        END IF;

        IF NEW."reservedQuantity" IS NOT NULL AND NEW."reservedQuantity" < 0 THEN
          RAISE EXCEPTION 'Reserved Quantity must be non-negative' USING ERRCODE = '23514';
        END IF;

        IF NEW."reorderLevel" IS NOT NULL AND NEW."reorderLevel" < 0 THEN
          RAISE EXCEPTION 'Reorder Level must be non-negative' USING ERRCODE = '23514';
        END IF;

        v_on_hand := COALESCE(NEW."quantityOnHand", 0);
        v_reserved := COALESCE(NEW."reservedQuantity", 0);
        v_available := v_on_hand - v_reserved;

        IF v_available < 0 THEN
          RAISE EXCEPTION 'Reserved Quantity cannot exceed Quantity on Hand (Available Quantity must be non-negative)' USING ERRCODE = '23514';
        END IF;

        NEW."quantityOnHand" := v_on_hand;
        NEW."reservedQuantity" := v_reserved;
        NEW."availableQuantity" := v_available;
        NEW."lastUpdated" := NOW();

        -- Infer itemType if not explicitly chosen
        IF NEW."itemType" IS NULL THEN
          IF NEW."rawMaterialId" IS NOT NULL AND NEW."productId" IS NULL THEN
            NEW."itemType" := 'RAW_MATERIAL';
          ELSE
            NEW."itemType" := 'PRODUCT';
          END IF;
        END IF;

        -- Determine effective reorder level (local reorderLevel or linked Raw Material reorderLevel)
        v_reorder := NEW."reorderLevel";
        IF v_reorder IS NULL AND NEW."rawMaterialId" IS NOT NULL THEN
          SELECT "reorderLevel" INTO v_reorder
          FROM ${schema}.${tMat}
          WHERE id = NEW."rawMaterialId";
        END IF;

        IF v_available <= 0 THEN
          NEW."stockStatus" := 'OUT_OF_STOCK';
          NEW."isLowStock" := true;
        ELSIF v_reorder IS NOT NULL AND v_available <= v_reorder THEN
          NEW."stockStatus" := 'LOW_STOCK';
          NEW."isLowStock" := true;
        ELSE
          NEW."stockStatus" := 'IN_STOCK';
          NEW."isLowStock" := false;
        END IF;

        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;

      DROP TRIGGER IF EXISTS trg_mfg_inventory_before_write ON ${schema}.${tInv};
      CREATE TRIGGER trg_mfg_inventory_before_write
      BEFORE INSERT OR UPDATE ON ${schema}.${tInv}
      FOR EACH ROW EXECUTE FUNCTION ${schema}.mfg_inventory_before_write();

      -- 4. Quality Control trigger: auto-ID, non-negative quantities, Passed + Failed <= Inspected, Pass Rate %, inherit Product from Production Order
      CREATE OR REPLACE FUNCTION ${schema}.mfg_quality_control_before_write()
      RETURNS TRIGGER AS $$
      DECLARE
        v_inspected numeric;
        v_passed numeric;
        v_failed numeric;
        v_po_product_id uuid;
      BEGIN
        IF NEW.name IS NULL OR BTRIM(NEW.name) = '' THEN
          NEW.name := 'QC-' || nextval('${schema}.mfg_qc_seq');
        END IF;

        IF NEW."quantityInspected" IS NOT NULL AND NEW."quantityInspected" < 0 THEN
          RAISE EXCEPTION 'Quantity Inspected must be non-negative' USING ERRCODE = '23514';
        END IF;

        IF NEW."quantityPassed" IS NOT NULL AND NEW."quantityPassed" < 0 THEN
          RAISE EXCEPTION 'Quantity Passed must be non-negative' USING ERRCODE = '23514';
        END IF;

        IF NEW."quantityFailed" IS NOT NULL AND NEW."quantityFailed" < 0 THEN
          RAISE EXCEPTION 'Quantity Failed must be non-negative' USING ERRCODE = '23514';
        END IF;

        v_inspected := COALESCE(NEW."quantityInspected", 0);
        v_passed := COALESCE(NEW."quantityPassed", 0);
        v_failed := COALESCE(NEW."quantityFailed", 0);

        IF (v_passed + v_failed) > v_inspected THEN
          RAISE EXCEPTION 'Quantity Passed plus Quantity Failed (% + % = %) cannot exceed Quantity Inspected (%)',
            v_passed, v_failed, (v_passed + v_failed), v_inspected USING ERRCODE = '23514';
        END IF;

        IF v_inspected > 0 THEN
          NEW."passRate" := ROUND((v_passed / v_inspected) * 100, 2);
        ELSE
          NEW."passRate" := 0;
        END IF;

        -- Auto-link product from production order if omitted
        IF NEW."productId" IS NULL AND NEW."productionOrderId" IS NOT NULL THEN
          SELECT "productId" INTO v_po_product_id
          FROM ${schema}.${tPO}
          WHERE id = NEW."productionOrderId";
          IF v_po_product_id IS NOT NULL THEN
            NEW."productId" := v_po_product_id;
          END IF;
        END IF;

        IF NEW.result IS NULL THEN
          IF v_inspected = 0 THEN
            NEW.result := 'PENDING';
          ELSIF v_failed = 0 AND v_passed = v_inspected THEN
            NEW.result := 'PASSED';
          ELSIF v_passed = 0 AND v_failed > 0 THEN
            NEW.result := 'FAILED';
          ELSE
            NEW.result := 'CONDITIONAL';
          END IF;
        END IF;

        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;

      DROP TRIGGER IF EXISTS trg_mfg_quality_control_before_write ON ${schema}.${tQC};
      CREATE TRIGGER trg_mfg_quality_control_before_write
      BEFORE INSERT OR UPDATE ON ${schema}.${tQC}
      FOR EACH ROW EXECUTE FUNCTION ${schema}.mfg_quality_control_before_write();

      -- 5. Bill of Materials trigger: auto-ref + non-negative validation
      CREATE OR REPLACE FUNCTION ${schema}.mfg_bom_before_write()
      RETURNS TRIGGER AS $$
      BEGIN
        IF NEW.name IS NULL OR BTRIM(NEW.name) = '' THEN
          NEW.name := 'BOM-' || nextval('${schema}.mfg_bom_seq');
        END IF;

        IF NEW."quantityRequired" IS NOT NULL AND NEW."quantityRequired" < 0 THEN
          RAISE EXCEPTION 'BOM Quantity Required must be non-negative' USING ERRCODE = '23514';
        END IF;

        IF NEW."scrapFactorPercent" IS NOT NULL AND NEW."scrapFactorPercent" < 0 THEN
          RAISE EXCEPTION 'BOM Scrap Factor must be non-negative' USING ERRCODE = '23514';
        END IF;

        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;

      DROP TRIGGER IF EXISTS trg_mfg_bom_before_write ON ${schema}.${tBOM};
      CREATE TRIGGER trg_mfg_bom_before_write
      BEFORE INSERT OR UPDATE ON ${schema}.${tBOM}
      FOR EACH ROW EXECUTE FUNCTION ${schema}.mfg_bom_before_write();

      -- 6. Supplier Materials trigger: auto-ref + non-negative validation
      CREATE OR REPLACE FUNCTION ${schema}.mfg_supplier_material_before_write()
      RETURNS TRIGGER AS $$
      BEGIN
        IF NEW.name IS NULL OR BTRIM(NEW.name) = '' THEN
          NEW.name := 'SM-' || nextval('${schema}.mfg_sm_seq');
        END IF;

        IF NEW."leadTimeDays" IS NOT NULL AND NEW."leadTimeDays" < 0 THEN
          RAISE EXCEPTION 'Supplier Lead Time must be non-negative' USING ERRCODE = '23514';
        END IF;

        IF NEW."minimumOrderQuantity" IS NOT NULL AND NEW."minimumOrderQuantity" < 0 THEN
          RAISE EXCEPTION 'Minimum Order Quantity must be non-negative' USING ERRCODE = '23514';
        END IF;

        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;

      DROP TRIGGER IF EXISTS trg_mfg_supplier_material_before_write ON ${schema}.${tSM};
      CREATE TRIGGER trg_mfg_supplier_material_before_write
      BEFORE INSERT OR UPDATE ON ${schema}.${tSM}
      FOR EACH ROW EXECUTE FUNCTION ${schema}.mfg_supplier_material_before_write();

      -- 7. Products & Suppliers defaults
      CREATE OR REPLACE FUNCTION ${schema}.mfg_product_before_write()
      RETURNS TRIGGER AS $$
      BEGIN
        IF NEW.status IS NULL THEN
          NEW.status := 'ACTIVE';
        END IF;
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;

      DROP TRIGGER IF EXISTS trg_mfg_product_before_write ON ${schema}.${tProd};
      CREATE TRIGGER trg_mfg_product_before_write
      BEFORE INSERT OR UPDATE ON ${schema}.${tProd}
      FOR EACH ROW EXECUTE FUNCTION ${schema}.mfg_product_before_write();

      CREATE OR REPLACE FUNCTION ${schema}.mfg_supplier_before_write()
      RETURNS TRIGGER AS $$
      BEGIN
        IF NEW.status IS NULL THEN
          NEW.status := 'ACTIVE';
        END IF;
        IF NEW."approvalStage" IS NULL THEN
          NEW."approvalStage" := 'PROSPECT';
        END IF;
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;

      DROP TRIGGER IF EXISTS trg_mfg_supplier_before_write ON ${schema}.${tSup};
      CREATE TRIGGER trg_mfg_supplier_before_write
      BEFORE INSERT OR UPDATE ON ${schema}.${tSup}
      FOR EACH ROW EXECUTE FUNCTION ${schema}.mfg_supplier_before_write();
    `);

    console.log('  [ok] Installed all sequences, unique indexes, calculations, and validation triggers.');

    // =========================================================================
    // STEP 4: KANBAN PIPELINE VIEWS & TABLE VIEW COLUMN ORDERING
    // =========================================================================
    console.log('\n[4/5] Configuring Kanban pipelines, Table views, and Create Forms...');

    const ensureKanbanView = async (objId, viewName, icon, groupFieldId) => {
      if (!groupFieldId) return;
      const ex = await c.query(
        `SELECT id FROM core.view WHERE "workspaceId" = $1 AND "objectMetadataId" = $2 AND type = 'KANBAN' AND name = $3`,
        [wsId, objId, viewName],
      );
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
        console.log(`  [ok] Created Kanban view "${viewName}"`);
      }
    };

    await ensureKanbanView(productionOrderObj.id, 'Production Pipeline', 'IconSettings', resolvedProductionStageField?.id);
    await ensureKanbanView(supplierObj.id, 'Supplier Approval Pipeline', 'IconTruck', resolvedSupplierApprovalStageField?.id);

    const populateKanbanFields = async (objId, viewName, fieldNames) => {
      const vRes = await c.query(`SELECT id FROM core.view WHERE "workspaceId" = $1 AND "objectMetadataId" = $2 AND type = 'KANBAN' AND name = $3 LIMIT 1`, [wsId, objId, viewName]);
      if (vRes.rows.length === 0) return;
      const viewId = vRes.rows[0].id;
      const fRes = await c.query(`SELECT id, name FROM core."fieldMetadata" WHERE "workspaceId" = $1 AND "objectMetadataId" = $2`, [wsId, objId]);
      const fMap = {};
      fRes.rows.forEach((r) => { fMap[r.name] = r.id; });
      const appResK = await c.query(`SELECT id FROM core.application WHERE "workspaceId" = $1 AND name = 'Custom' LIMIT 1`, [wsId]);
      const appIdK = appResK.rows[0]?.id;
      await c.query(`DELETE FROM core."viewField" WHERE "viewId" = $1`, [viewId]);
      for (let i = 0; i < fieldNames.length; i++) {
        const fId = fMap[fieldNames[i]];
        if (fId) {
          await c.query(
            `INSERT INTO core."viewField" (id, "universalIdentifier", "viewId", "fieldMetadataId", position, "isVisible", "isActive", size, "workspaceId", "applicationId", "createdAt", "updatedAt")
             VALUES (gen_random_uuid(), gen_random_uuid(), $1, $2, $3, true, true, 160, $4, $5, NOW(), NOW())`,
            [viewId, fId, i, wsId, appIdK],
          );
        }
      }
    };
    await populateKanbanFields(productionOrderObj.id, 'Production Pipeline', ['name', 'product', 'plannedQuantity', 'producedQuantity', 'priority', 'dueDate']);
    await populateKanbanFields(supplierObj.id, 'Supplier Approval Pipeline', ['name', 'supplierCode', 'contactPerson', 'paymentTerms', 'status']);

    // Order TABLE view fields cleanly for each Manufacturing module
    const appRes = await c.query(`SELECT id FROM core.application WHERE "workspaceId" = $1 AND name = 'Custom' LIMIT 1`, [wsId]);
    const customAppId = appRes.rows[0]?.id || (await c.query(`SELECT id FROM core.application WHERE "workspaceId" = $1 LIMIT 1`, [wsId])).rows[0]?.id;

    const moduleTableColumns = [
      {
        objId: productObj.id,
        viewName: 'All Products',
        fields: ['name', 'productCode', 'category', 'unitOfMeasure', 'standardCost', 'sellingPrice', 'status', 'description'],
      },
      {
        objId: productionOrderObj.id,
        viewName: 'All Production Orders',
        fields: ['name', 'product', 'plannedQuantity', 'producedQuantity', 'stage', 'priority', 'startDate', 'dueDate', 'actualCompletionDate', 'assignedTeam', 'notes'],
      },
      {
        objId: rawMaterialObj.id,
        viewName: 'All Raw Materials',
        fields: ['name', 'materialCode', 'category', 'unitOfMeasure', 'availableQuantity', 'reorderLevel', 'unitCost', 'primarySupplier', 'storageLocation', 'status'],
      },
      {
        objId: supplierObj.id,
        viewName: 'All Suppliers',
        fields: ['name', 'supplierCode', 'contactPerson', 'phone', 'email', 'paymentTerms', 'approvalStage', 'status', 'supplierAddress'],
      },
      {
        objId: inventoryObj.id,
        viewName: 'All Inventory',
        fields: ['name', 'itemType', 'product', 'rawMaterial', 'warehouseLocation', 'quantityOnHand', 'reservedQuantity', 'availableQuantity', 'reorderLevel', 'isLowStock', 'stockStatus', 'lastUpdated'],
      },
      {
        objId: qualityControlObj.id,
        viewName: 'All Quality Control',
        fields: ['name', 'productionOrder', 'product', 'inspectionDate', 'inspectorName', 'quantityInspected', 'quantityPassed', 'quantityFailed', 'passRate', 'result', 'defectNotes'],
      },
      {
        objId: bomObj.id,
        viewName: 'All Bill of Materials',
        fields: ['name', 'product', 'rawMaterial', 'quantityRequired', 'unitOfMeasure', 'scrapFactorPercent', 'notes'],
      },
      {
        objId: supplierMaterialObj.id,
        viewName: 'All Supplier Materials',
        fields: ['name', 'supplier', 'rawMaterial', 'unitPrice', 'leadTimeDays', 'minimumOrderQuantity', 'isPreferred'],
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
              [viewId, fId, i, i === 0 ? 200 : 150, wsId, customAppId],
            );
          }
        }
      }
    }

    // =========================================================================
    // STEP 5: SIDEBAR NAVIGATION (PRESERVE EXISTING REAL ESTATE & WORKFLOWS!)
    // =========================================================================
    console.log('\n[5/5] Organizing Manufacturing sidebar navigation (preserving existing modules & Workflows)...');

    const mfgNavItems = [
      { objId: productObj.id, name: 'Products', icon: 'IconPackage', color: 'blue' },
      { objId: productionOrderObj.id, name: 'Production Orders', icon: 'IconSettings', color: 'orange' },
      { objId: rawMaterialObj.id, name: 'Raw Materials', icon: 'IconCube', color: 'purple' },
      { objId: supplierObj.id, name: 'Suppliers', icon: 'IconTruck', color: 'turquoise' },
      { objId: inventoryObj.id, name: 'Inventory', icon: 'IconBuildingWarehouse', color: 'sky' },
      { objId: qualityControlObj.id, name: 'Quality Control', icon: 'IconChecklist', color: 'green' },
      { objId: bomObj.id, name: 'Bill of Materials', icon: 'IconListTree', color: 'amber' },
      { objId: supplierMaterialObj.id, name: 'Supplier Materials', icon: 'IconLink', color: 'cyan' },
    ];

    if (isOnboardingTemplate) {
      // Fresh Manufacturing CRM workspace: place 8 REAL custom Manufacturing modules at top-level 0..7 and keep Workflows folder active at 8
      for (let i = 0; i < mfgNavItems.length; i++) {
        const item = mfgNavItems[i];
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
      await c.query(`DELETE FROM core."navigationMenuItem" WHERE "workspaceId" = $1 AND type = 'FOLDER' AND name = 'Manufacturing'`, [wsId]);

      // Ensure Workflows objects are active and Workflows folder exists at position 8 (NEVER delete Workflows!)
      await c.query(
        `UPDATE core."objectMetadata" SET "isActive" = true WHERE "workspaceId" = $1 AND "nameSingular" IN ('workflow', 'workflowRun', 'workflowVersion')`,
        [wsId],
      );
      const exWfFolder = await c.query(
        `SELECT id FROM core."navigationMenuItem" WHERE "workspaceId" = $1 AND type = 'FOLDER' AND name = 'Workflows'`,
        [wsId],
      );
      if (exWfFolder.rows.length > 0) {
        await c.query(`UPDATE core."navigationMenuItem" SET position = 8, "updatedAt" = NOW() WHERE id = $1`, [exWfFolder.rows[0].id]);
      } else {
        const wfIns = await c.query(
          `INSERT INTO core."navigationMenuItem" (
             id, "universalIdentifier", name, icon, color, position, type, "workspaceId", "applicationId", "createdAt", "updatedAt"
           ) VALUES (
             gen_random_uuid(), gen_random_uuid(), 'Workflows', 'IconSettingsAutomation', 'orange', 8, 'FOLDER', $1, $2, NOW(), NOW()
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

      // Hide stock CRM objects from top-level sidebar (without deleting data or Workflows!)
      const stockHidden = await c.query(
        `SELECT id FROM core."objectMetadata" WHERE "workspaceId" = $1 AND "nameSingular" IN ('company', 'person', 'opportunity', 'task', 'note', 'dashboard')`,
        [wsId],
      );
      for (const row of stockHidden.rows) {
        await c.query(
          `DELETE FROM core."navigationMenuItem" WHERE "workspaceId" = $1 AND "targetObjectMetadataId" = $2`,
          [wsId, row.id],
        );
      }
    } else {
      // Additive mode on existing workspace: preserve EVERY existing nav item & Workflows, place Manufacturing items cleanly in a 'Manufacturing' folder
      let mfgFolderId;
      const exFolder = await c.query(
        `SELECT id FROM core."navigationMenuItem" WHERE "workspaceId" = $1 AND type = 'FOLDER' AND name = 'Manufacturing'`,
        [wsId],
      );
      if (exFolder.rows.length > 0) {
        mfgFolderId = exFolder.rows[0].id;
      } else {
        const maxPosRes = await c.query(
          `SELECT COALESCE(MAX(position), 0)::int as max_pos FROM core."navigationMenuItem" WHERE "workspaceId" = $1 AND "folderId" IS NULL`,
          [wsId],
        );
        const folderPos = (maxPosRes.rows[0]?.max_pos ?? 7) + 1;
        const insFolder = await c.query(
          `INSERT INTO core."navigationMenuItem" (
             id, "universalIdentifier", name, icon, color, position, type, "workspaceId", "applicationId", "createdAt", "updatedAt"
           ) VALUES (
             gen_random_uuid(), gen_random_uuid(), 'Manufacturing', 'IconBuildingFactory2', 'blue', $1, 'FOLDER', $2, $3, NOW(), NOW()
           ) RETURNING id`,
          [folderPos, wsId, customAppId],
        );
        mfgFolderId = insFolder.rows[0].id;
      }

      for (let i = 0; i < mfgNavItems.length; i++) {
        const item = mfgNavItems[i];
        const ex = await c.query(
          `SELECT id FROM core."navigationMenuItem" WHERE "workspaceId" = $1 AND "targetObjectMetadataId" = $2`,
          [wsId, item.objId],
        );
        if (ex.rows.length > 0) {
          await c.query(
            `UPDATE core."navigationMenuItem" SET name = $1, icon = $2, color = $3, position = $4, "folderId" = $5, "updatedAt" = NOW() WHERE id = $6`,
            [item.name, item.icon, item.color, i, mfgFolderId, ex.rows[0].id],
          );
        } else {
          await c.query(
            `INSERT INTO core."navigationMenuItem" (
               id, "universalIdentifier", name, icon, color, position, type, "folderId", "targetObjectMetadataId", "workspaceId", "applicationId", "createdAt", "updatedAt"
             ) VALUES (
               gen_random_uuid(), gen_random_uuid(), $1, $2, $3, $4, 'OBJECT', $5, $6, $7, $8, NOW(), NOW()
             )`,
            [item.name, item.icon, item.color, i, mfgFolderId, item.objId, wsId, customAppId],
          );
        }
      }
    }

    // =========================================================================
    // STEP 6: SEED REALISTIC INTERCONNECTED MANUFACTURING SAMPLE DATA (IDEMPOTENT)
    // =========================================================================
    console.log('\n[6/6] Seeding interconnected Manufacturing CRM sample data across all 8 modules...');

    const SYS_COLS = '"createdByName", "updatedByName", "createdBySource", "updatedBySource"';
    const SYS_VALS = "'System', 'System', 'MANUAL', 'MANUAL'";

    // 1. Suppliers (6)
    const sampleSuppliers = [
      { id: '22222222-1001-4000-8000-000000000001', name: 'Apex Precision Alloys & Metals', code: 'SUP-101', contact: 'Marcus Sterling', phone: '3135550101', cc: 'US', call: '+1', email: 'm.sterling@apexalloys.com', addr: '104 Industrial Parkway, Building 4, Detroit, MI 48201', terms: 'NET_30', stage: 'PREFERRED', status: 'ACTIVE' },
      { id: '22222222-1002-4000-8000-000000000002', name: 'India Aluminium Trading Company (IATC)', code: 'SUP-102', contact: 'Rajesh Nair', phone: '9840155102', cc: 'IN', call: '+91', email: 'rajesh.nair@iatcaluminium.in', addr: 'Plot 42, SIPCOT Industrial Park, Chennai, TN 602105', terms: 'NET_30', stage: 'APPROVED', status: 'ACTIVE' },
      { id: '22222222-1003-4000-8000-000000000003', name: 'MicroTech Semiconductor Solutions', code: 'SUP-103', contact: 'Takeshi Tanaka', phone: '4085550103', cc: 'US', call: '+1', email: 't.tanaka@microtech-ic.com', addr: '502 Tech Blvd, Silicon Corridor, San Jose, CA 95134', terms: 'NET_45', stage: 'APPROVED', status: 'ACTIVE' },
      { id: '22222222-1004-4000-8000-000000000004', name: 'Global Chemical & Polymer Corp', code: 'SUP-104', contact: 'Elena Rostova', phone: '7135550104', cc: 'US', call: '+1', email: 'e.rostova@globalchemical.com', addr: 'Pier 9, Logistics Harbor Terminal, Houston, TX 77012', terms: 'NET_60', stage: 'AUDIT', status: 'ACTIVE' },
      { id: '22222222-1005-4000-8000-000000000005', name: 'Fastener & Heavy Hardware Dynamics', code: 'SUP-105', contact: 'Carlos Morales', phone: '3125550105', cc: 'US', call: '+1', email: 'c.morales@fastenerdynamics.com', addr: '77 Hardware Blvd, Zone 3, Chicago, IL 60607', terms: 'NET_15', stage: 'UNDER_REVIEW', status: 'ACTIVE' },
      { id: '22222222-1006-4000-8000-000000000006', name: 'Vanguard Composite Materials', code: 'SUP-106', contact: 'Dr. Sandra Patel', phone: '5125550106', cc: 'US', call: '+1', email: 's.patel@vanguardcomposites.com', addr: '88 Carbon Road, Advanced Tech Park, Austin, TX 78758', terms: 'DUE_ON_RECEIPT', stage: 'PROSPECT', status: 'ACTIVE' },
    ];
    for (let i = 0; i < sampleSuppliers.length; i++) {
      const x = sampleSuppliers[i];
      await c.query(
        `INSERT INTO ${schema}.${tSup} (
           id, name, "supplierCode", "contactPerson", "phonePrimaryPhoneNumber", "phonePrimaryPhoneCountryCode", "phonePrimaryPhoneCallingCode",
           "emailPrimaryEmail", "supplierAddress", "paymentTerms", "approvalStage", status, position, ${SYS_COLS}
         ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, ${SYS_VALS})
         ON CONFLICT (id) DO NOTHING`,
        [x.id, x.name, x.code, x.contact, x.phone, x.cc, x.call, x.email, x.addr, x.terms, x.stage, x.status, i],
      );
    }

    // 2. Products (6)
    const sampleProducts = [
      { id: '11111111-1001-4000-8000-000000000001', name: 'Industrial AC Servo Motor V4', sku: 'SKU-7001', cat: 'MECHANICAL', uom: 'PCS', cost: 420, price: 1250, desc: 'High-torque brushless AC servo motor with integrated 20-bit encoder for CNC robotics.', status: 'ACTIVE' },
      { id: '11111111-1002-4000-8000-000000000002', name: 'Microprocessor Control Board X10', sku: 'SKU-7002', cat: 'ELECTRONICS', uom: 'PCS', cost: 65, price: 220, desc: 'Dual-core industrial PLC controller board with CAN-FD and EtherCAT interfaces.', status: 'ACTIVE' },
      { id: '11111111-1003-4000-8000-000000000003', name: 'Heavy-Duty Hydraulic Actuator 5000', sku: 'SKU-7003', cat: 'HYDRAULIC', uom: 'PCS', cost: 260, price: 780, desc: '350-bar rated double-acting hydraulic cylinder actuator with precision honed bore.', status: 'ACTIVE' },
      { id: '11111111-1004-4000-8000-000000000004', name: 'Modular Lithium Power Pack 48V', sku: 'SKU-7004', cat: 'ENERGY_POWER', uom: 'PCS', cost: 890, price: 2650, desc: '5.2 kWh industrial 48V NMC battery module with active liquid thermal management.', status: 'ACTIVE' },
      { id: '11111111-1005-4000-8000-000000000005', name: 'CNC Milled Aluminum Chassis 200', sku: 'SKU-7005', cat: 'STRUCTURAL', uom: 'PCS', cost: 110, price: 340, desc: '5-axis CNC machined 6061-T6 structural enclosure anodized for corrosion resistance.', status: 'ACTIVE' },
      { id: '11111111-1006-4000-8000-000000000006', name: 'Aerospace Carbon Fiber Fairing Ring', sku: 'SKU-7006', cat: 'COMPOSITES', uom: 'PCS', cost: 980, price: 3200, desc: 'Autoclave-cured Toray T800 carbon composite fairing ring with <0.15% void ratio.', status: 'ACTIVE' },
    ];
    for (let i = 0; i < sampleProducts.length; i++) {
      const x = sampleProducts[i];
      await c.query(
        `INSERT INTO ${schema}.${tProd} (
           id, name, "productCode", category, "unitOfMeasure",
           "standardCostAmountMicros", "standardCostCurrencyCode",
           "sellingPriceAmountMicros", "sellingPriceCurrencyCode",
           description, status, position, ${SYS_COLS}
         ) VALUES ($1, $2, $3, $4, $5, $6, 'USD', $7, 'USD', $8, $9, $10, ${SYS_VALS})
         ON CONFLICT (id) DO NOTHING`,
        [x.id, x.name, x.sku, x.cat, x.uom, x.cost * 1000000, x.price * 1000000, x.desc, x.status, i],
      );
    }

    // 3. Raw Materials (6 - includes AVAILABLE, LOW_STOCK, OUT_OF_STOCK auto-computed by trigger!)
    const sampleMaterials = [
      { id: '33333333-1001-4000-8000-000000000001', name: 'Grade 6061-T6 Aluminum Billets', code: 'MAT-9001', cat: 'METALS_ALLOYS', uom: 'KG', avail: 2450, reorder: 500, cost: 85.5, supId: sampleSuppliers[1].id, loc: 'Raw Yard A-12' },
      { id: '33333333-1002-4000-8000-000000000002', name: 'High-Purity Silicon Wafers 200mm', code: 'MAT-9002', cat: 'SEMICONDUCTORS', uom: 'PCS', avail: 180, reorder: 200, cost: 42.0, supId: sampleSuppliers[2].id, loc: 'Cleanroom B-04' },
      { id: '33333333-1003-4000-8000-000000000003', name: 'Copper Magnet Wire 18 AWG', code: 'MAT-9003', cat: 'ELECTRICAL', uom: 'SPOOL', avail: 45, reorder: 15, cost: 19.5, supId: sampleSuppliers[0].id, loc: 'Electrical Rack C-02' },
      { id: '33333333-1004-4000-8000-000000000004', name: 'Neodymium Rare-Earth Magnets N52', code: 'MAT-9004', cat: 'METALS_ALLOYS', uom: 'PCS', avail: 120, reorder: 250, cost: 28.75, supId: sampleSuppliers[0].id, loc: 'Secure Vault D-01' },
      { id: '33333333-1005-4000-8000-000000000005', name: 'Automotive Lithium NMC Cathode Powder', code: 'MAT-9005', cat: 'POLYMERS_CHEMICALS', uom: 'KG', avail: 1800, reorder: 400, cost: 38.0, supId: sampleSuppliers[3].id, loc: 'Dry Room E-01' },
      { id: '33333333-1006-4000-8000-000000000006', name: 'Aerospace Toray T800 Carbon Prepreg', code: 'MAT-9006', cat: 'COMPOSITES', uom: 'SQM', avail: 0, reorder: 80, cost: 145.0, supId: sampleSuppliers[5].id, loc: 'Freezer Bay F-02' },
    ];
    for (let i = 0; i < sampleMaterials.length; i++) {
      const x = sampleMaterials[i];
      await c.query(
        `INSERT INTO ${schema}.${tMat} (
           id, name, "materialCode", category, "unitOfMeasure", "availableQuantity", "reorderLevel",
           "unitCostAmountMicros", "unitCostCurrencyCode", "primarySupplierId", "storageLocation", position, ${SYS_COLS}
         ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'USD', $9, $10, $11, ${SYS_VALS})
         ON CONFLICT (id) DO NOTHING`,
        [x.id, x.name, x.code, x.cat, x.uom, x.avail, x.reorder, Math.round(x.cost * 1000000), x.supId, x.loc, i],
      );
    }

    // 4. Supplier Materials (8 links - multiple suppliers for MAT-9001 and MAT-9003!)
    const sampleSupplierMaterials = [
      { id: '88888888-1001-4000-8000-000000000001', name: 'SM-1001', supId: sampleSuppliers[1].id, matId: sampleMaterials[0].id, price: 85.5, lead: 5, moq: 250, pref: true },
      { id: '88888888-1002-4000-8000-000000000002', name: 'SM-1002', supId: sampleSuppliers[0].id, matId: sampleMaterials[0].id, price: 89.0, lead: 7, moq: 100, pref: false },
      { id: '88888888-1003-4000-8000-000000000003', name: 'SM-1003', supId: sampleSuppliers[2].id, matId: sampleMaterials[1].id, price: 42.0, lead: 14, moq: 100, pref: true },
      { id: '88888888-1004-4000-8000-000000000004', name: 'SM-1004', supId: sampleSuppliers[0].id, matId: sampleMaterials[2].id, price: 19.5, lead: 4, moq: 20, pref: true },
      { id: '88888888-1005-4000-8000-000000000005', name: 'SM-1005', supId: sampleSuppliers[4].id, matId: sampleMaterials[2].id, price: 21.0, lead: 6, moq: 10, pref: false },
      { id: '88888888-1006-4000-8000-000000000006', name: 'SM-1006', supId: sampleSuppliers[0].id, matId: sampleMaterials[3].id, price: 28.75, lead: 10, moq: 200, pref: true },
      { id: '88888888-1007-4000-8000-000000000007', name: 'SM-1007', supId: sampleSuppliers[3].id, matId: sampleMaterials[4].id, price: 38.0, lead: 12, moq: 500, pref: true },
      { id: '88888888-1008-4000-8000-000000000008', name: 'SM-1008', supId: sampleSuppliers[5].id, matId: sampleMaterials[5].id, price: 145.0, lead: 18, moq: 50, pref: true },
    ];
    for (let i = 0; i < sampleSupplierMaterials.length; i++) {
      const x = sampleSupplierMaterials[i];
      await c.query(
        `INSERT INTO ${schema}.${tSM} (
           id, name, "supplierId", "rawMaterialId", "unitPriceAmountMicros", "unitPriceCurrencyCode",
           "leadTimeDays", "minimumOrderQuantity", "isPreferred", position, ${SYS_COLS}
         ) VALUES ($1, $2, $3, $4, $5, 'USD', $6, $7, $8, $9, ${SYS_VALS})
         ON CONFLICT (id) DO NOTHING`,
        [x.id, x.name, x.supId, x.matId, Math.round(x.price * 1000000), x.lead, x.moq, x.pref, i],
      );
    }

    // 5. Bill of Materials (8 lines linking Products <-> Raw Materials)
    const sampleBOM = [
      { id: '77777777-1001-4000-8000-000000000001', name: 'BOM-1001', prodId: sampleProducts[0].id, matId: sampleMaterials[0].id, qty: 4.5, uom: 'KG', scrap: 3.0, notes: 'Motor housing billet for CNC turning' },
      { id: '77777777-1002-4000-8000-000000000002', name: 'BOM-1002', prodId: sampleProducts[0].id, matId: sampleMaterials[2].id, qty: 2.0, uom: 'UNIT', scrap: 1.5, notes: 'Stator copper coil winding' },
      { id: '77777777-1003-4000-8000-000000000003', name: 'BOM-1003', prodId: sampleProducts[0].id, matId: sampleMaterials[3].id, qty: 12, uom: 'PCS', scrap: 0.5, notes: 'Rotor permanent magnet poles' },
      { id: '77777777-1004-4000-8000-000000000004', name: 'BOM-1004', prodId: sampleProducts[1].id, matId: sampleMaterials[1].id, qty: 1, uom: 'PCS', scrap: 2.0, notes: 'Primary MCU wafer die allocation' },
      { id: '77777777-1005-4000-8000-000000000005', name: 'BOM-1005', prodId: sampleProducts[2].id, matId: sampleMaterials[0].id, qty: 8.0, uom: 'KG', scrap: 4.0, notes: 'Actuator manifold block machining' },
      { id: '77777777-1006-4000-8000-000000000006', name: 'BOM-1006', prodId: sampleProducts[3].id, matId: sampleMaterials[4].id, qty: 14.0, uom: 'KG', scrap: 1.0, notes: 'Cell cathode active coating slurry' },
      { id: '77777777-1007-4000-8000-000000000007', name: 'BOM-1007', prodId: sampleProducts[4].id, matId: sampleMaterials[0].id, qty: 6.2, uom: 'KG', scrap: 5.0, notes: '5-axis milled chassis frame' },
      { id: '77777777-1008-4000-8000-000000000008', name: 'BOM-1008', prodId: sampleProducts[5].id, matId: sampleMaterials[5].id, qty: 3.5, uom: 'SQM', scrap: 4.5, notes: '12-ply autoclave carbon layup' },
    ];
    for (let i = 0; i < sampleBOM.length; i++) {
      const x = sampleBOM[i];
      await c.query(
        `INSERT INTO ${schema}.${tBOM} (
           id, name, "productId", "rawMaterialId", "quantityRequired", "unitOfMeasure", "scrapFactorPercent", notes, position, ${SYS_COLS}
         ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, ${SYS_VALS})
         ON CONFLICT (id) DO NOTHING`,
        [x.id, x.name, x.prodId, x.matId, x.qty, x.uom, x.scrap, x.notes, i],
      );
    }

    // 6. Production Orders (6 orders across all Kanban stages!)
    const sampleOrders = [
      { id: '44444444-1001-4000-8000-000000000001', name: 'PO-1001', prodId: sampleProducts[0].id, planned: 500, produced: 320, start: '2026-11-05', due: '2026-11-25', comp: null, team: 'Line A - Robotics', stage: 'IN_PRODUCTION', prio: 'HIGH', notes: 'Priority export batch for German automation OEM.' },
      { id: '44444444-1002-4000-8000-000000000002', name: 'PO-1002', prodId: sampleProducts[1].id, planned: 1200, produced: 1200, start: '2026-11-01', due: '2026-11-20', comp: null, team: 'SMT Cleanroom B', stage: 'QUALITY_CHECK', prio: 'HIGH', notes: 'Completed SMT reflow; undergoing 125C burn-in QC.' },
      { id: '44444444-1003-4000-8000-000000000003', name: 'PO-1003', prodId: sampleProducts[2].id, planned: 150, produced: 0, start: '2026-11-22', due: '2026-12-05', comp: null, team: 'Hydraulics Bay 2', stage: 'PLANNING', prio: 'MEDIUM', notes: 'Material kit reserved from Raw Yard A-12.' },
      { id: '44444444-1004-4000-8000-000000000004', name: 'PO-1004', prodId: sampleProducts[3].id, planned: 300, produced: 300, start: '2026-10-20', due: '2026-11-12', comp: '2026-11-11', team: 'Battery Assembly C', stage: 'COMPLETED', prio: 'HIGH', notes: 'Delivered ahead of schedule; 100% QC pass rate.' },
      { id: '44444444-1005-4000-8000-000000000005', name: 'PO-1005', prodId: sampleProducts[4].id, planned: 800, produced: 0, start: '2026-11-26', due: '2026-12-15', comp: null, team: 'CNC Milling Line 1', stage: 'NEW_ORDER', prio: 'LOW', notes: 'Scheduled for Q4 stock replenishment.' },
      { id: '44444444-1006-4000-8000-000000000006', name: 'PO-1006', prodId: sampleProducts[5].id, planned: 75, produced: 75, start: '2026-11-02', due: '2026-11-21', comp: null, team: 'Autoclave Bay 4', stage: 'QUALITY_CHECK', prio: 'MEDIUM', notes: 'Autoclave cure complete; awaiting ultrasonic NDT release.' },
    ];
    for (let i = 0; i < sampleOrders.length; i++) {
      const x = sampleOrders[i];
      await c.query(
        `INSERT INTO ${schema}.${tPO} (
           id, name, "productId", "plannedQuantity", "producedQuantity", "startDate", "dueDate", "actualCompletionDate",
           "assignedTeam", stage, priority, notes, position, ${SYS_COLS}
         ) VALUES ($1, $2, $3, $4, $5, $6::date, $7::date, $8::date, $9, $10, $11, $12, $13, ${SYS_VALS})
         ON CONFLICT (id) DO NOTHING`,
        [x.id, x.name, x.prodId, x.planned, x.produced, x.start, x.due, x.comp, x.team, x.stage, x.prio, x.notes, i],
      );
    }

    // 7. Inventory (8 warehouse lots - 4 Products + 4 Raw Materials, trigger auto-calculates Available Quantity, Low Stock Flag, Stock Status, Last Updated!)
    const sampleInventory = [
      { id: '55555555-1001-4000-8000-000000000001', name: 'INV-1001', type: 'PRODUCT', prodId: sampleProducts[0].id, matId: null, loc: 'Main Warehouse - Bay A1', onHand: 450, reserved: 100, reorder: 150 },
      { id: '55555555-1002-4000-8000-000000000002', name: 'INV-1002', type: 'PRODUCT', prodId: sampleProducts[1].id, matId: null, loc: 'Cleanroom Vault B2', onHand: 140, reserved: 60, reorder: 100 },
      { id: '55555555-1003-4000-8000-000000000003', name: 'INV-1003', type: 'PRODUCT', prodId: sampleProducts[2].id, matId: null, loc: 'South Depot - Dock 3', onHand: 180, reserved: 20, reorder: 50 },
      { id: '55555555-1004-4000-8000-000000000004', name: 'INV-1004', type: 'PRODUCT', prodId: sampleProducts[3].id, matId: null, loc: 'Hazmat Staging C1', onHand: 320, reserved: 320, reorder: 50 },
      { id: '55555555-1005-4000-8000-000000000005', name: 'INV-1005', type: 'RAW_MATERIAL', prodId: null, matId: sampleMaterials[0].id, loc: 'Raw Material Yard A-12', onHand: 2450, reserved: 450, reorder: null },
      { id: '55555555-1006-4000-8000-000000000006', name: 'INV-1006', type: 'RAW_MATERIAL', prodId: null, matId: sampleMaterials[1].id, loc: 'Cleanroom Cold Room B-04', onHand: 220, reserved: 40, reorder: null },
      { id: '55555555-1007-4000-8000-000000000007', name: 'INV-1007', type: 'RAW_MATERIAL', prodId: null, matId: sampleMaterials[3].id, loc: 'High-Value Vault D-01', onHand: 150, reserved: 30, reorder: null },
      { id: '55555555-1008-4000-8000-000000000008', name: 'INV-1008', type: 'RAW_MATERIAL', prodId: null, matId: sampleMaterials[5].id, loc: 'Freezer Vault F-02 (-18C)', onHand: 0, reserved: 0, reorder: null },
    ];
    for (let i = 0; i < sampleInventory.length; i++) {
      const x = sampleInventory[i];
      await c.query(
        `INSERT INTO ${schema}.${tInv} (
           id, name, "itemType", "productId", "rawMaterialId", "warehouseLocation",
           "quantityOnHand", "reservedQuantity", "reorderLevel", position, ${SYS_COLS}
         ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, ${SYS_VALS})
         ON CONFLICT (id) DO NOTHING`,
        [x.id, x.name, x.type, x.prodId, x.matId, x.loc, x.onHand, x.reserved, x.reorder, i],
      );
    }

    // 8. Quality Control (7 inspections - including 2 on PO-1001 to demonstrate one-to-many!)
    const sampleQC = [
      { id: '66666666-1001-4000-8000-000000000001', name: 'QC-1001', poId: sampleOrders[0].id, prodId: sampleProducts[0].id, date: '2026-11-12', insp: 'Devon Ross', inspected: 100, passed: 98, failed: 2, notes: 'Batch 1 torque load check: 2 units showed minor encoder offset; sent for recalibration.' },
      { id: '66666666-1002-4000-8000-000000000002', name: 'QC-1002', poId: sampleOrders[0].id, prodId: sampleProducts[0].id, date: '2026-11-16', insp: 'Kavita Nair', inspected: 220, passed: 220, failed: 0, notes: 'Batch 2 thermal endurance & vibration test passed 100%.' },
      { id: '66666666-1003-4000-8000-000000000003', name: 'QC-1003', poId: sampleOrders[1].id, prodId: sampleProducts[1].id, date: '2026-11-17', insp: 'Kavita Nair', inspected: 1200, passed: 1194, failed: 6, notes: '125C high-temperature burn-in stress test: 6 solder bridge defects isolated.' },
      { id: '66666666-1004-4000-8000-000000000004', name: 'QC-1004', poId: sampleOrders[3].id, prodId: sampleProducts[3].id, date: '2026-11-11', insp: 'Devon Ross', inspected: 300, passed: 300, failed: 0, notes: 'UN 3480 thermal dissipation & cyclic charge-discharge audit certified.' },
      { id: '66666666-1005-4000-8000-000000000005', name: 'QC-1005', poId: sampleOrders[5].id, prodId: sampleProducts[5].id, date: '2026-11-18', insp: 'Dr. Sandra Patel', inspected: 75, passed: 75, failed: 0, notes: 'Ultrasonic NDT void scan verified 0.12% void ratio (<1.0% aerospace spec).' },
      { id: '66666666-1006-4000-8000-000000000006', name: 'QC-1006', poId: sampleOrders[2].id, prodId: sampleProducts[2].id, date: '2026-11-15', insp: 'Liam Gallagher', inspected: 10, passed: 0, failed: 10, notes: 'Pre-production prototype seal failed 350-bar pressure hold; vendor seal redesign required.' },
      { id: '66666666-1007-4000-8000-000000000007', name: 'QC-1007', poId: sampleOrders[4].id, prodId: sampleProducts[4].id, date: '2026-11-18', insp: 'Devon Ross', inspected: 0, passed: 0, failed: 0, notes: 'Scheduled for first-article CMM dimensional inspection upon CNC start.' },
    ];
    for (let i = 0; i < sampleQC.length; i++) {
      const x = sampleQC[i];
      await c.query(
        `INSERT INTO ${schema}.${tQC} (
           id, name, "productionOrderId", "productId", "inspectionDate", "inspectorName",
           "quantityInspected", "quantityPassed", "quantityFailed", "defectNotes", position, ${SYS_COLS}
         ) VALUES ($1, $2, $3, $4, $5::date, $6, $7, $8, $9, $10, $11, ${SYS_VALS})
         ON CONFLICT (id) DO NOTHING`,
        [x.id, x.name, x.poId, x.prodId, x.date, x.insp, x.inspected, x.passed, x.failed, x.notes, i],
      );
    }

    // Advance auto-ID sequences past seeded numbers so new user-created records never collide!
    await c.query(`
      SELECT setval('${schema}.mfg_po_seq', GREATEST(1010, (SELECT last_value FROM ${schema}.mfg_po_seq)));
      SELECT setval('${schema}.mfg_inv_seq', GREATEST(1010, (SELECT last_value FROM ${schema}.mfg_inv_seq)));
      SELECT setval('${schema}.mfg_qc_seq', GREATEST(1010, (SELECT last_value FROM ${schema}.mfg_qc_seq)));
      SELECT setval('${schema}.mfg_bom_seq', GREATEST(1010, (SELECT last_value FROM ${schema}.mfg_bom_seq)));
      SELECT setval('${schema}.mfg_sm_seq', GREATEST(1010, (SELECT last_value FROM ${schema}.mfg_sm_seq)));
    `);
    console.log('  [ok] Seeded realistic sample data across all 8 Manufacturing modules (Suppliers, Products, Raw Materials, Supplier Materials, BOM, Production Orders, Inventory, Quality Control).');

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
    console.log(`MANUFACTURING CRM PROVISIONING COMPLETE FOR WORKSPACE ${wsId}!`);
    console.log('=========================================================================');

    return {
      workspaceId: wsId,
      schema,
      objects: {
        product: productObj.id,
        supplier: supplierObj.id,
        rawMaterial: rawMaterialObj.id,
        productionOrder: productionOrderObj.id,
        inventoryItem: inventoryObj.id,
        qualityControl: qualityControlObj.id,
        billOfMaterial: bomObj.id,
        supplierMaterial: supplierMaterialObj.id,
      },
      tables: tableMap,
    };
  } finally {
    await c.end();
  }
}

module.exports = { provisionManufacturingModules };
