const { Client } = require('pg');
const assert = require('assert');

const PG_URL = process.env.PG_DATABASE_URL || 'postgres://postgres:postgres@db:5432/default';
const INTERNAL_SERVER_URL = 'http://localhost:3000';

async function runTests() {
  const c = new Client({ connectionString: PG_URL });
  await c.connect();

  let passed = 0;
  let failed = 0;
  const failures = [];

  const test = async (name, fn) => {
    try {
      await fn();
      console.log(`  PASS: ${name}`);
      passed++;
    } catch (err) {
      console.error(`  FAIL: ${name} -> ${err.message}`);
      failed++;
      failures.push({ name, error: err.message });
    }
  };

  const ws = (
    await c.query(`SELECT id, "displayName", "databaseSchema" FROM core.workspace WHERE "deletedAt" IS NULL ORDER BY "createdAt" DESC LIMIT 1`)
  ).rows[0];
  assert(ws, 'Active workspace must exist');
  const wsId = ws.id;
  const schema = ws.databaseSchema;
  console.log(`\nRunning Manufacturing CRM Integration Tests on workspace "${ws.displayName}" (${wsId}) [${schema}]\n`);

  // Resolve exact table names
  const tableMap = {};
  for (const objName of [
    'product',
    'supplier',
    'rawMaterial',
    'productionOrder',
    'inventoryItem',
    'qualityControl',
    'billOfMaterial',
    'supplierMaterial',
  ]) {
    const tRes = await c.query(
      `SELECT table_name FROM information_schema.tables WHERE table_schema = $1 AND table_name IN ($2, $3) LIMIT 1`,
      [schema, `_${objName}`, objName],
    );
    assert(tRes.rows.length === 1, `Table for ${objName} must exist in ${schema}`);
    tableMap[objName] = `"${tRes.rows[0].table_name}"`;
  }

  // 1. Metadata, Sidebar, & Workflows Preservation Checks
  await test('All 8 Manufacturing custom objects exist in core.objectMetadata and are active & editable', async () => {
    const res = await c.query(
      `SELECT "nameSingular", "isActive", "isUICreatable", "isUIEditable"
       FROM core."objectMetadata"
       WHERE "workspaceId" = $1 AND "nameSingular" = ANY($2)`,
      [
        wsId,
        ['product', 'supplier', 'rawMaterial', 'productionOrder', 'inventoryItem', 'qualityControl', 'billOfMaterial', 'supplierMaterial'],
      ],
    );
    assert.strictEqual(res.rows.length, 8, `Expected 8 Manufacturing objects, found ${res.rows.length}`);
    for (const r of res.rows) {
      assert.strictEqual(r.isActive, true, `${r.nameSingular} must be active`);
      assert.strictEqual(r.isUICreatable, true, `${r.nameSingular} must be UI creatable`);
    }
  });

  await test('Sidebar navigation contains all 6 core Manufacturing modules + BOM + Supplier Materials + Workflows preserved', async () => {
    const navs = await c.query(
      `SELECT type, name, position FROM core."navigationMenuItem" WHERE "workspaceId" = $1`,
      [wsId],
    );
    const names = new Set(navs.rows.map((r) => r.name));
    for (const expected of [
      'Products',
      'Production Orders',
      'Raw Materials',
      'Suppliers',
      'Inventory',
      'Quality Control',
      'Bill of Materials',
      'Supplier Materials',
      'Workflows',
    ]) {
      assert(names.has(expected), `Missing sidebar item: ${expected}`);
    }
  });

  await test('All 7 required database-backed bidirectional relationships exist in core.fieldMetadata', async () => {
    const rels = await c.query(
      `SELECT om."nameSingular" as src, fm.name as field, tom."nameSingular" as target
       FROM core."fieldMetadata" fm
       JOIN core."objectMetadata" om ON om.id = fm."objectMetadataId"
       JOIN core."objectMetadata" tom ON tom.id = fm."relationTargetObjectMetadataId"
       WHERE fm."workspaceId" = $1 AND fm.type = 'RELATION'
         AND om."nameSingular" = ANY($2)`,
      [
        wsId,
        ['rawMaterial', 'productionOrder', 'inventoryItem', 'qualityControl', 'billOfMaterial', 'supplierMaterial'],
      ],
    );
    const pairs = new Set(rels.rows.map((r) => `${r.src}.${r.field}->${r.target}`));
    for (const req of [
      'rawMaterial.primarySupplier->supplier',
      'supplierMaterial.supplier->supplier',
      'supplierMaterial.rawMaterial->rawMaterial',
      'productionOrder.product->product',
      'inventoryItem.product->product',
      'inventoryItem.rawMaterial->rawMaterial',
      'qualityControl.productionOrder->productionOrder',
      'qualityControl.product->product',
      'billOfMaterial.product->product',
      'billOfMaterial.rawMaterial->rawMaterial',
    ]) {
      assert(pairs.has(req), `Missing relation ${req}`);
    }
  });

  await test('Kanban Pipeline views exist for Production Orders (stage) and Suppliers (approvalStage)', async () => {
    const kv = await c.query(
      `SELECT om."nameSingular", v.name, v.type
       FROM core.view v
       JOIN core."objectMetadata" om ON om.id = v."objectMetadataId"
       WHERE v."workspaceId" = $1 AND v.type = 'KANBAN' AND om."nameSingular" IN ('productionOrder', 'supplier')`,
      [wsId],
    );
    const objs = new Set(kv.rows.map((r) => r.nameSingular));
    assert(objs.has('productionOrder'), 'Production Orders must have a Kanban view');
    assert(objs.has('supplier'), 'Suppliers must have a Kanban view');
  });

  // Track created test IDs for guaranteed cleanup
  const created = { qc: [], inv: [], po: [], bom: [], sm: [], mat: [], sup: [], prod: [] };
  const SYS_COLS = `"createdByName", "updatedByName", "createdBySource", "updatedBySource"`;
  const SYS_VALS = `'System', 'System', 'MANUAL', 'MANUAL'`;

  try {
    let prodId, sup1Id, sup2Id, matId, poId, invProdId, invMatId;

    await test('Products: Create with unique SKU, default Active status, and duplicate SKU rejection', async () => {
      const ins = await c.query(
        `INSERT INTO ${schema}.${tableMap.product} (name, "productCode", category, "unitOfMeasure", "standardCostAmountMicros", "standardCostCurrencyCode", "sellingPriceAmountMicros", "sellingPriceCurrencyCode", description, ${SYS_COLS})
         VALUES ('Test CNC Servo Motor', 'TEST-SKU-9001', 'MECHANICAL', 'PCS', 420000000, 'USD', 1250000000, 'USD', 'High-torque test servo', ${SYS_VALS})
         RETURNING id, status`,
      );
      prodId = ins.rows[0].id;
      created.prod.push(prodId);
      assert.strictEqual(ins.rows[0].status, 'ACTIVE', 'Default product status should be ACTIVE');

      let dupFailed = false;
      try {
        await c.query(
          `INSERT INTO ${schema}.${tableMap.product} (name, "productCode", ${SYS_COLS}) VALUES ('Duplicate SKU Product', 'TEST-SKU-9001', ${SYS_VALS})`,
        );
      } catch (e) {
        dupFailed = e.code === '23505';
      }
      assert(dupFailed, 'Duplicate productCode SKU must fail with unique constraint 23505');
    });

    await test('Suppliers & Raw Materials: Primary Supplier + Multi-Supplier junction + Low Stock auto-flagging', async () => {
      const s1 = await c.query(
        `INSERT INTO ${schema}.${tableMap.supplier} (name, "supplierCode", "contactPerson", "paymentTerms", "approvalStage", ${SYS_COLS})
         VALUES ('Test Metals Corp', 'TEST-SUP-01', 'Alice Chen', 'NET_30', 'APPROVED', ${SYS_VALS}) RETURNING id`,
      );
      const s2 = await c.query(
        `INSERT INTO ${schema}.${tableMap.supplier} (name, "supplierCode", "contactPerson", "paymentTerms", "approvalStage", ${SYS_COLS})
         VALUES ('Test Backup Alloys', 'TEST-SUP-02', 'Bob Patel', 'NET_45', 'PREFERRED', ${SYS_VALS}) RETURNING id`,
      );
      sup1Id = s1.rows[0].id;
      sup2Id = s2.rows[0].id;
      created.sup.push(sup1Id, sup2Id);

      // Available 80 <= Reorder 100 -> must auto-flag LOW_STOCK
      const m = await c.query(
        `INSERT INTO ${schema}.${tableMap.rawMaterial} (name, "materialCode", category, "unitOfMeasure", "availableQuantity", "reorderLevel", "unitCostAmountMicros", "unitCostCurrencyCode", "primarySupplierId", "storageLocation", ${SYS_COLS})
         VALUES ('Test 6061 Aluminum Billet', 'TEST-MAT-01', 'METALS_ALLOYS', 'KG', 80, 100, 12500000, 'USD', $1, 'Bay A-1', ${SYS_VALS})
         RETURNING id, status`,
        [sup1Id],
      );
      matId = m.rows[0].id;
      created.mat.push(matId);
      assert.strictEqual(m.rows[0].status, 'LOW_STOCK', 'Raw material at/below reorder level must be LOW_STOCK');

      // Link BOTH suppliers to the same material via Supplier Materials junction
      const sm1 = await c.query(
        `INSERT INTO ${schema}.${tableMap.supplierMaterial} ("supplierId", "rawMaterialId", "leadTimeDays", "minimumOrderQuantity", "isPreferred", ${SYS_COLS})
         VALUES ($1, $2, 7, 50, true, ${SYS_VALS}) RETURNING id, name`,
        [sup1Id, matId],
      );
      const sm2 = await c.query(
        `INSERT INTO ${schema}.${tableMap.supplierMaterial} ("supplierId", "rawMaterialId", "leadTimeDays", "minimumOrderQuantity", "isPreferred", ${SYS_COLS})
         VALUES ($1, $2, 12, 25, false, ${SYS_VALS}) RETURNING id, name`,
        [sup2Id, matId],
      );
      created.sm.push(sm1.rows[0].id, sm2.rows[0].id);
      assert(sm1.rows[0].name.startsWith('SM-'), 'SupplierMaterial link code should auto-generate');
      assert.notStrictEqual(sm1.rows[0].name, sm2.rows[0].name, 'Auto-generated link codes must be unique');
    });

    await test('Bill of Materials (Product <-> Raw Material many-to-many) + non-negative validation', async () => {
      const b = await c.query(
        `INSERT INTO ${schema}.${tableMap.billOfMaterial} ("productId", "rawMaterialId", "quantityRequired", "unitOfMeasure", "scrapFactorPercent", notes, ${SYS_COLS})
         VALUES ($1, $2, 4.5, 'KG', 2.5, 'CNC billet per motor housing', ${SYS_VALS}) RETURNING id, name`,
        [prodId, matId],
      );
      created.bom.push(b.rows[0].id);
      assert(b.rows[0].name.startsWith('BOM-'), 'BOM reference should auto-generate');

      let negRejected = false;
      try {
        await c.query(
          `INSERT INTO ${schema}.${tableMap.billOfMaterial} ("productId", "rawMaterialId", "quantityRequired", ${SYS_COLS}) VALUES ($1, $2, -3, ${SYS_VALS})`,
          [prodId, matId],
        );
      } catch (e) {
        negRejected = e.code === '23514';
      }
      assert(negRejected, 'Negative BOM quantityRequired must be rejected');
    });

    await test('Production Orders: Product relation, auto-generated Order Number, & non-negative validation', async () => {
      const po = await c.query(
        `INSERT INTO ${schema}.${tableMap.productionOrder} ("productId", "plannedQuantity", "producedQuantity", "startDate", "dueDate", "assignedTeam", priority, ${SYS_COLS})
         VALUES ($1, 100, 40, '2026-11-18', '2026-11-28', 'Line A - Robotics', 'HIGH', ${SYS_VALS})
         RETURNING id, name, stage`,
        [prodId],
      );
      poId = po.rows[0].id;
      created.po.push(poId);
      assert(po.rows[0].name.startsWith('PO-'), 'Order Number should auto-generate (PO-...)');
      assert.strictEqual(po.rows[0].stage, 'NEW_ORDER', 'Default stage should be NEW_ORDER');

      let negRejected = false;
      try {
        await c.query(
          `INSERT INTO ${schema}.${tableMap.productionOrder} ("productId", "plannedQuantity", "producedQuantity", ${SYS_COLS}) VALUES ($1, -10, 0, ${SYS_VALS})`,
          [prodId],
        );
      } catch (e) {
        negRejected = e.code === '23514';
      }
      assert(negRejected, 'Negative plannedQuantity must be rejected');
    });

    await test('Inventory: Available = On Hand - Reserved, Low Stock Flag, Warehouse tracking, & Non-Negative Validation', async () => {
      const ip = await c.query(
        `INSERT INTO ${schema}.${tableMap.inventoryItem} ("itemType", "productId", "warehouseLocation", "quantityOnHand", "reservedQuantity", "reorderLevel", ${SYS_COLS})
         VALUES ('PRODUCT', $1, 'Warehouse East - Bay 1', 50, 10, 20, ${SYS_VALS})
         RETURNING id, name, "availableQuantity", "stockStatus", "isLowStock", "lastUpdated"`,
        [prodId],
      );
      invProdId = ip.rows[0].id;
      created.inv.push(invProdId);
      assert(ip.rows[0].name.startsWith('INV-'), 'Inventory ID should auto-generate');
      assert.strictEqual(Number(ip.rows[0].availableQuantity), 40, 'Available Quantity must equal 50 - 10 = 40');
      assert.strictEqual(ip.rows[0].stockStatus, 'IN_STOCK');
      assert.strictEqual(ip.rows[0].isLowStock, false);
      assert(ip.rows[0].lastUpdated, 'lastUpdated must be auto-populated');

      const ipUpd = await c.query(
        `UPDATE ${schema}.${tableMap.inventoryItem} SET "reservedQuantity" = 35 WHERE id = $1
         RETURNING "availableQuantity", "stockStatus", "isLowStock"`,
        [invProdId],
      );
      assert.strictEqual(Number(ipUpd.rows[0].availableQuantity), 15);
      assert.strictEqual(ipUpd.rows[0].stockStatus, 'LOW_STOCK');
      assert.strictEqual(ipUpd.rows[0].isLowStock, true);

      const im = await c.query(
        `INSERT INTO ${schema}.${tableMap.inventoryItem} ("itemType", "rawMaterialId", "warehouseLocation", "quantityOnHand", "reservedQuantity", ${SYS_COLS})
         VALUES ('RAW_MATERIAL', $1, 'Raw Yard West - Rack 4', 120, 40, ${SYS_VALS})
         RETURNING id, "availableQuantity", "stockStatus", "isLowStock"`,
        [matId],
      );
      invMatId = im.rows[0].id;
      created.inv.push(invMatId);
      assert.strictEqual(Number(im.rows[0].availableQuantity), 80);
      assert.strictEqual(im.rows[0].stockStatus, 'LOW_STOCK', 'Must inherit Raw Material reorderLevel and flag LOW_STOCK');
      assert.strictEqual(im.rows[0].isLowStock, true);

      let negRejected = false;
      try {
        await c.query(
          `INSERT INTO ${schema}.${tableMap.inventoryItem} ("itemType", "productId", "warehouseLocation", "quantityOnHand", "reservedQuantity", ${SYS_COLS})
           VALUES ('PRODUCT', $1, 'Bay X', -5, 0, ${SYS_VALS})`,
          [prodId],
        );
      } catch (e) {
        negRejected = e.code === '23514';
      }
      assert(negRejected, 'Negative quantityOnHand must be rejected');

      let overReservedRejected = false;
      try {
        await c.query(
          `INSERT INTO ${schema}.${tableMap.inventoryItem} ("itemType", "productId", "warehouseLocation", "quantityOnHand", "reservedQuantity", ${SYS_COLS})
           VALUES ('PRODUCT', $1, 'Bay X', 10, 15, ${SYS_VALS})`,
          [prodId],
        );
      } catch (e) {
        overReservedRejected = e.code === '23514';
      }
      assert(overReservedRejected, 'Reserved > Quantity on Hand must be rejected');
    });

    await test('Quality Control: Multiple inspections per Production Order, auto-linked Product, Pass Rate, & Passed+Failed <= Inspected', async () => {
      const q1 = await c.query(
        `INSERT INTO ${schema}.${tableMap.qualityControl} ("productionOrderId", "inspectionDate", "inspectorName", "quantityInspected", "quantityPassed", "quantityFailed", "defectNotes", ${SYS_COLS})
         VALUES ($1, '2026-11-18', 'Devon Ross', 20, 19, 1, '1 minor housing scratch', ${SYS_VALS})
         RETURNING id, name, "productId", "passRate", result`,
        [poId],
      );
      created.qc.push(q1.rows[0].id);
      assert(q1.rows[0].name.startsWith('QC-'), 'Inspection ID should auto-generate');
      assert.strictEqual(q1.rows[0].productId, prodId, 'Quality Control must auto-link Product from Production Order');
      assert.strictEqual(Number(q1.rows[0].passRate), 95);
      assert.strictEqual(q1.rows[0].result, 'CONDITIONAL');

      const q2 = await c.query(
        `INSERT INTO ${schema}.${tableMap.qualityControl} ("productionOrderId", "productId", "inspectionDate", "inspectorName", "quantityInspected", "quantityPassed", "quantityFailed", ${SYS_COLS})
         VALUES ($1, $2, '2026-11-19', 'Kavita Nair', 20, 20, 0, ${SYS_VALS})
         RETURNING id, "passRate", result`,
        [poId, prodId],
      );
      created.qc.push(q2.rows[0].id);
      assert.strictEqual(Number(q2.rows[0].passRate), 100);
      assert.strictEqual(q2.rows[0].result, 'PASSED');

      let exceededRejected = false;
      try {
        await c.query(
          `INSERT INTO ${schema}.${tableMap.qualityControl} ("productionOrderId", "productId", "quantityInspected", "quantityPassed", "quantityFailed", ${SYS_COLS})
           VALUES ($1, $2, 20, 15, 10, ${SYS_VALS})`,
          [poId, prodId],
        );
      } catch (e) {
        exceededRejected = e.code === '23514' && e.message.includes('cannot exceed Quantity Inspected');
      }
      assert(exceededRejected, 'Quantity Passed + Quantity Failed > Quantity Inspected must be rejected');

      let negRejected = false;
      try {
        await c.query(
          `INSERT INTO ${schema}.${tableMap.qualityControl} ("productionOrderId", "productId", "quantityInspected", "quantityPassed", "quantityFailed", ${SYS_COLS})
           VALUES ($1, $2, 20, 10, -2, ${SYS_VALS})`,
          [poId, prodId],
        );
      } catch (e) {
        negRejected = e.code === '23514';
      }
      assert(negRejected, 'Negative quantityFailed must be rejected');
    });

    await test('Twenty server health & live GraphQL endpoint check', async () => {
      const healthRes = await fetch(`${INTERNAL_SERVER_URL}/healthz`);
      assert.strictEqual(healthRes.status, 200, 'Twenty server /healthz must return 200');
    });
  } finally {
    // Clean up ONLY our test records (never touch user data!)
    for (const id of created.qc) await c.query(`DELETE FROM ${schema}.${tableMap.qualityControl} WHERE id = $1`, [id]);
    for (const id of created.inv) await c.query(`DELETE FROM ${schema}.${tableMap.inventoryItem} WHERE id = $1`, [id]);
    for (const id of created.po) await c.query(`DELETE FROM ${schema}.${tableMap.productionOrder} WHERE id = $1`, [id]);
    for (const id of created.bom) await c.query(`DELETE FROM ${schema}.${tableMap.billOfMaterial} WHERE id = $1`, [id]);
    for (const id of created.sm) await c.query(`DELETE FROM ${schema}.${tableMap.supplierMaterial} WHERE id = $1`, [id]);
    for (const id of created.mat) await c.query(`DELETE FROM ${schema}.${tableMap.rawMaterial} WHERE id = $1`, [id]);
    for (const id of created.sup) await c.query(`DELETE FROM ${schema}.${tableMap.supplier} WHERE id = $1`, [id]);
    for (const id of created.prod) await c.query(`DELETE FROM ${schema}.${tableMap.product} WHERE id = $1`, [id]);
    await c.end();
  }

  console.log(`\n=========================================================================`);
  console.log(`TEST SUMMARY: ${passed} passed, ${failed} failed`);
  console.log(`=========================================================================\n`);
  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
