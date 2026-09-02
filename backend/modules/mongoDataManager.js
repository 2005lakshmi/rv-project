// MongoDB-based Data Manager
// Replaces JSON file-based storage with MongoDB collections

const { getDB, getClient } = require('../db/mongoConnection');
const fs = require('fs');
const path = require('path');

const PRODUCT_NAME_MAP = {
  'PROD-001': 'Transmissions',
  'PROD-002': 'Electric Drives',
  'PROD-003': 'Air bags and Seat belts',
  'PROD-004': 'Breaking and Safety Systems',
  'PROD-005': 'Powertrain Components'
};

function normalizeCurrentStock(currentStock = {}) {
  return Object.entries(currentStock).reduce((normalized, [productId, quantity]) => {
    const displayName = PRODUCT_NAME_MAP[productId] || productId;
    normalized[displayName] = quantity;
    return normalized;
  }, {});
}

function normalizeWarehouse(warehouse) {
  if (!warehouse || !warehouse.currentStock) {
    return warehouse;
  }

  return {
    ...warehouse,
    currentStock: normalizeCurrentStock(warehouse.currentStock)
  };
}

class MongoDataManager {
  constructor() {
    this.db = null;
    this.initialized = false;
  }

  /**
   * Initialize the data manager and load initial data from JSON files if collections are empty
   */
  async initialize() {
    this.db = getDB();
    this.initialized = true;
    
    // Check if collections exist and have data
    const whCount = await this.db.collection('warehouses').countDocuments();
    const custCount = await this.db.collection('customers').countDocuments();
    
    if (whCount === 0 || custCount === 0) {
      console.log('📥 Loading initial data from JSON files...');
      await this.loadInitialDataFromJSON();
    } else {
      console.log('✓ Data already exists in MongoDB');
    }
  }

  /**
   * Load initial data from JSON files into MongoDB
   */
  async loadInitialDataFromJSON() {
    try {
      const dataDir = path.join(__dirname, '../data');
      console.log(`📁 Loading data from: ${dataDir}`);
      
      // Load warehouses (JSON is a direct array, not wrapped)
      console.log('📦 Loading warehouses...');
      const warehousesData = JSON.parse(
        fs.readFileSync(path.join(dataDir, 'warehouses.json'), 'utf8')
      );
      console.log(`  Found ${Array.isArray(warehousesData) ? warehousesData.length : 0} warehouses in JSON`);
      
      if (Array.isArray(warehousesData) && warehousesData.length > 0) {
        await this.db.collection('warehouses').deleteMany({});
        const warehousesToInsert = warehousesData.map(w => ({
          ...w,
          createdAt: new Date()
        }));
        const whResult = await this.db.collection('warehouses').insertMany(warehousesToInsert);
        console.log(`✓ Inserted ${whResult.insertedCount} warehouses`);
      }

      // Load customers (JSON is a direct array, not wrapped)
      console.log('👥 Loading customers...');
      const customersData = JSON.parse(
        fs.readFileSync(path.join(dataDir, 'customers.json'), 'utf8')
      );
      console.log(`  Found ${Array.isArray(customersData) ? customersData.length : 0} customers in JSON`);
      
      if (Array.isArray(customersData) && customersData.length > 0) {
        await this.db.collection('customers').deleteMany({});
        const customersToInsert = customersData.map(c => ({
          ...c,
          createdAt: new Date()
        }));
        const custResult = await this.db.collection('customers').insertMany(customersToInsert);
        console.log(`✓ Inserted ${custResult.insertedCount} customers`);
      }

      // Load products if provided
      try {
        const productsPath = path.join(dataDir, 'products.json');
        if (fs.existsSync(productsPath)) {
          console.log('📦 Loading products...');
          const productsData = JSON.parse(fs.readFileSync(productsPath, 'utf8')) || [];
          console.log(`  Found ${Array.isArray(productsData) ? productsData.length : 0} products in JSON`);
          if (Array.isArray(productsData) && productsData.length > 0) {
            await this.db.collection('products').deleteMany({});
            const productsToInsert = productsData.map(p => ({
              ...p,
              createdAt: new Date(p.createdAt || Date.now()),
              updatedAt: new Date(p.updatedAt || Date.now())
            }));
            const prodResult = await this.db.collection('products').insertMany(productsToInsert);
            console.log(`✓ Inserted ${prodResult.insertedCount} products`);
          }
        } else {
          console.log('  No products.json found, skipping product seed');
        }
      } catch (prodErr) {
        console.warn('Product seed warning:', prodErr.message);
      }

      // Load demand history (JSON is an object with customer IDs as keys)
      console.log('📊 Loading demand history...');
      const demandData = JSON.parse(
        fs.readFileSync(path.join(dataDir, 'demand_history.json'), 'utf8')
      );
      if (typeof demandData === 'object' && !Array.isArray(demandData)) {
        await this.db.collection('demandHistory').deleteMany({});
        const demandRecords = [];
        for (const [customerId, productData] of Object.entries(demandData)) {
          for (const [productId, quantities] of Object.entries(productData)) {
            if (Array.isArray(quantities)) {
              quantities.forEach((quantity, dayIndex) => {
                demandRecords.push({
                  customerId,
                  productId,
                  quantity,
                  day: dayIndex,
                  createdAt: new Date()
                });
              });
            }
          }
        }
        if (demandRecords.length > 0) {
          const demandResult = await this.db.collection('demandHistory').insertMany(demandRecords);
          console.log(`✓ Inserted ${demandResult.insertedCount} demand history records`);
        } else {
          console.log('  No demand records to insert');
        }
      }

      console.log('✅ Initial data loaded successfully');
      
    } catch (error) {
      console.error('❌ Error loading initial data:', error.message);
      console.error('Stack:', error.stack);
      throw error;
    }
  }

  // ========== WAREHOUSE OPERATIONS ==========

  async getWarehouses(options = {}) {
    // If no options provided, return all warehouses (preserves previous behavior)
    const { page, limit, status, search, sortBy = 'createdAt', sortOrder = 'desc' } = options || {};
    if (!page && !limit && !status && !search) {
      const warehouses = await this.db.collection('warehouses').find({}).toArray();
      return warehouses.map(normalizeWarehouse);
    }

    const filter = {};
    if (status) filter.status = status;
    if (search) {
      const regex = new RegExp(search, 'i');
      filter.$or = [{ name: regex }, { code: regex }, { address: regex }];
    }

    const skip = page ? (Number(page) - 1) * Number(limit || 20) : 0;
    const sort = { [sortBy]: sortOrder === 'asc' ? 1 : -1 };

    const [total, warehouses] = await Promise.all([
      this.db.collection('warehouses').countDocuments(filter),
      this.db.collection('warehouses').find(filter).sort(sort).skip(skip).limit(Number(limit || 20)).toArray()
    ]);

    return {
      total,
      page: Number(page || 1),
      limit: Number(limit || 20),
      warehouses: warehouses.map(normalizeWarehouse)
    };
  }

  async getWarehouse(warehouseId) {
    const warehouse = await this.db.collection('warehouses').findOne({ id: warehouseId });
    return normalizeWarehouse(warehouse);
  }

  async addWarehouse(warehouse) {
    const doc = { ...warehouse, createdAt: new Date(warehouse.createdAt || Date.now()), updatedAt: new Date() };
    return await this.db.collection('warehouses').insertOne(doc);
  }

  async updateWarehouse(warehouseId, update) {
    const setObj = { ...update, updatedAt: new Date() };
    return await this.db.collection('warehouses').updateOne({ id: warehouseId }, { $set: setObj });
  }

  async deleteWarehouse(warehouseId, soft = true) {
    if (soft) {
      return await this.db.collection('warehouses').updateOne({ id: warehouseId }, { $set: { status: 'INACTIVE', updatedAt: new Date() } });
    }
    return await this.db.collection('warehouses').deleteOne({ id: warehouseId });
  }

  async getWarehouseInventory(warehouseId) {
    const warehouse = await this.db.collection('warehouses').findOne({ id: warehouseId });
    return warehouse ? (warehouse.currentStock || {}) : null;
  }

  // ========== INVENTORY OPERATIONS ==========

  async getInventory(options = {}) {
    const { page = 1, limit = 50, warehouseId, productId, search, sortBy = 'lastUpdated', sortOrder = 'desc' } = options;
    const filter = {};
    if (warehouseId) filter.warehouseId = warehouseId;
    if (productId) filter.productId = productId;
    if (search) {
      const regex = new RegExp(search, 'i');
      filter.$or = [{ id: regex }, { productId: regex }];
    }

    const skip = (Number(page) - 1) * Number(limit);
    const sort = { [sortBy]: sortOrder === 'asc' ? 1 : -1 };

    const [total, items] = await Promise.all([
      this.db.collection('inventory').countDocuments(filter),
      this.db.collection('inventory').find(filter).sort(sort).skip(skip).limit(Number(limit)).toArray()
    ]);

    return { total, page: Number(page), limit: Number(limit), items };
  }

  async getInventoryItem(inventoryId) {
    return await this.db.collection('inventory').findOne({ id: inventoryId });
  }

  // ========== TRANSFER OPERATIONS ==========

  async createTransfer({ productId, sourceWarehouseId, destinationWarehouseId, quantity, createdBy = null, reference = '' }) {
    if (!productId || !sourceWarehouseId || !destinationWarehouseId || !quantity) {
      throw new Error('Missing required transfer fields');
    }
    if (sourceWarehouseId === destinationWarehouseId) throw new Error('Source and destination warehouses must be different');
    if (Number(quantity) <= 0) throw new Error('Quantity must be positive');

    const client = getClient();
    const session = client.startSession();
    try {
      let transferResult = null;
      await session.withTransaction(async () => {
        // Fetch inventory for source and destination
        const sourceInv = await this.db.collection('inventory').findOne({ productId, warehouseId: sourceWarehouseId }, { session });
        if (!sourceInv) throw new Error('Source inventory not found');
        const available = (sourceInv.quantity || 0) - (sourceInv.reservedQuantity || 0);
        if (available < Number(quantity)) throw new Error('Insufficient available stock in source warehouse');

        let destInv = await this.db.collection('inventory').findOne({ productId, warehouseId: destinationWarehouseId }, { session });
        if (!destInv) {
          // create destination inventory with zero then update
          const newInvId = 'INV-' + require('uuid').v4().substring(0, 8).toUpperCase();
          const doc = {
            id: newInvId,
            productId,
            warehouseId: destinationWarehouseId,
            quantity: 0,
            reservedQuantity: 0,
            availableQuantity: 0,
            minimumStockLevel: 0,
            lastUpdated: new Date(),
            createdAt: new Date(),
            updatedAt: new Date()
          };
          await this.db.collection('inventory').insertOne(doc, { session });
          destInv = doc;
        }

        // Decrement source
        const decResult = await this.db.collection('inventory').updateOne(
          { id: sourceInv.id, quantity: { $gte: Number(quantity) } },
          { $inc: { quantity: -Number(quantity) }, $set: { updatedAt: new Date(), lastUpdated: new Date() } },
          { session }
        );
        if (decResult.modifiedCount === 0) throw new Error('Failed to decrement source inventory');

        // Recalculate available for source
        const updatedSource = await this.db.collection('inventory').findOne({ id: sourceInv.id }, { session });
        await this.db.collection('inventory').updateOne({ id: sourceInv.id }, { $set: { availableQuantity: Math.max(0, (updatedSource.quantity || 0) - (updatedSource.reservedQuantity || 0)), updatedAt: new Date(), lastUpdated: new Date() } }, { session });

        // Increment dest
        await this.db.collection('inventory').updateOne({ id: destInv.id }, { $inc: { quantity: Number(quantity) }, $set: { updatedAt: new Date(), lastUpdated: new Date() } }, { session });
        const updatedDest = await this.db.collection('inventory').findOne({ id: destInv.id }, { session });
        await this.db.collection('inventory').updateOne({ id: destInv.id }, { $set: { availableQuantity: Math.max(0, (updatedDest.quantity || 0) - (updatedDest.reservedQuantity || 0)), updatedAt: new Date(), lastUpdated: new Date() } }, { session });

        // Create transfer record
        const transferId = 'TR-' + require('uuid').v4().substring(0, 8).toUpperCase();
        const transferDoc = {
          id: transferId,
          productId,
          sourceWarehouseId,
          destinationWarehouseId,
          quantity: Number(quantity),
          status: 'COMPLETED',
          createdBy,
          reference,
          createdAt: new Date()
        };
        await this.db.collection('transfers').insertOne(transferDoc, { session });

        // Inventory transactions for both sides
        const txOutId = 'ITX-' + require('uuid').v4().substring(0, 8).toUpperCase();
        await this.db.collection('inventoryTransactions').insertOne({ id: txOutId, inventoryId: sourceInv.id, type: 'TRANSFER_OUT', quantity: Number(quantity), reason: 'Warehouse transfer', reference: transferId, performedBy: createdBy, createdAt: new Date() }, { session });

        const txInId = 'ITX-' + require('uuid').v4().substring(0, 8).toUpperCase();
        const destInvAfter = await this.db.collection('inventory').findOne({ id: destInv.id }, { session });
        await this.db.collection('inventoryTransactions').insertOne({ id: txInId, inventoryId: destInvAfter.id, type: 'TRANSFER_IN', quantity: Number(quantity), reason: 'Warehouse transfer', reference: transferId, performedBy: createdBy, createdAt: new Date() }, { session });

        transferResult = transferDoc;
      });

      return transferResult;
    } finally {
      await session.endSession();
    }
  }

  async getTransfers(filter = {}) {
    return await this.db.collection('transfers').find(filter).toArray();
  }

  async getTransfer(transferId) {
    return await this.db.collection('transfers').findOne({ id: transferId });
  }

  async getInventoryByProductWarehouse(productId, warehouseId) {
    return await this.db.collection('inventory').findOne({ productId, warehouseId });
  }

  async _createInventoryRecord({ id, productId, warehouseId, quantity = 0, reservedQuantity = 0, minimumStockLevel = 0 }) {
    const rec = {
      id,
      productId,
      warehouseId,
      quantity: Number(quantity),
      reservedQuantity: Number(reservedQuantity),
      availableQuantity: Math.max(0, Number(quantity) - Number(reservedQuantity)),
      minimumStockLevel: Number(minimumStockLevel || 0),
      lastUpdated: new Date(),
      createdAt: new Date(),
      updatedAt: new Date()
    };
    await this.db.collection('inventory').insertOne(rec);
    return rec;
  }

  async _recordInventoryTransaction({ id, inventoryId, type, quantity, reason = '', reference = '', performedBy = null }) {
    const tx = {
      id,
      inventoryId,
      type,
      quantity: Number(quantity),
      reason,
      reference,
      performedBy,
      createdAt: new Date()
    };
    await this.db.collection('inventoryTransactions').insertOne(tx);
    return tx;
  }

  async addStock({ productId, warehouseId, quantity, minimumStockLevel = 0, performedBy = null, reason = '', reference = '' }) {
    if (Number(quantity) <= 0) throw new Error('Quantity must be positive');

    let inv = await this.getInventoryByProductWarehouse(productId, warehouseId);
    if (!inv) {
      const id = 'INV-' + require('uuid').v4().substring(0, 8).toUpperCase();
      inv = await this._createInventoryRecord({ id, productId, warehouseId, quantity, minimumStockLevel });
    } else {
      const result = await this.db.collection('inventory').updateOne({ id: inv.id }, { $inc: { quantity: Number(quantity) }, $set: { availableQuantity: { $subtract: ['$quantity', '$reservedQuantity'] }, updatedAt: new Date(), lastUpdated: new Date() } });
      // Mongo can't compute availableQuantity with $subtract in updateOne easily, recalc afterwards
      await this.db.collection('inventory').updateOne({ id: inv.id }, [{ $set: { availableQuantity: { $max: [{ $subtract: ['$quantity', '$reservedQuantity'] }, 0] }, updatedAt: new Date(), lastUpdated: new Date() } }]);
      inv = await this.getInventoryItem(inv.id);
    }

    const txId = 'ITX-' + require('uuid').v4().substring(0, 8).toUpperCase();
    await this._recordInventoryTransaction({ id: txId, inventoryId: inv.id, type: 'STOCK_IN', quantity, reason, reference, performedBy });
    return inv;
  }

  async removeStock({ inventoryId, productId, warehouseId, quantity, performedBy = null, reason = '', reference = '' }) {
    if (Number(quantity) <= 0) throw new Error('Quantity must be positive');

    let inv = null;
    if (inventoryId) inv = await this.getInventoryItem(inventoryId);
    else if (productId && warehouseId) inv = await this.getInventoryByProductWarehouse(productId, warehouseId);
    if (!inv) throw new Error('Inventory record not found');

    // Ensure enough available (quantity - reservedQuantity) >= quantity
    const available = (inv.quantity || 0) - (inv.reservedQuantity || 0);
    if (available < Number(quantity)) throw new Error('Insufficient available stock');

    const result = await this.db.collection('inventory').updateOne({ id: inv.id, quantity: { $gte: Number(quantity) } }, { $inc: { quantity: -Number(quantity) }, $set: { updatedAt: new Date(), lastUpdated: new Date() } });
    if (result.modifiedCount === 0) throw new Error('Failed to remove stock');

    // Recalculate availableQuantity
    await this.db.collection('inventory').updateOne({ id: inv.id }, [{ $set: { availableQuantity: { $max: [{ $subtract: ['$quantity', '$reservedQuantity'] }, 0] }, updatedAt: new Date(), lastUpdated: new Date() } }]);

    const txId = 'ITX-' + require('uuid').v4().substring(0, 8).toUpperCase();
    await this._recordInventoryTransaction({ id: txId, inventoryId: inv.id, type: 'STOCK_OUT', quantity, reason, reference, performedBy });
    return await this.getInventoryItem(inv.id);
  }

  async adjustStock({ inventoryId, productId, warehouseId, newQuantity, performedBy = null, reason = '', reference = '' }) {
    if (newQuantity == null || Number(newQuantity) < 0) throw new Error('newQuantity must be >= 0');
    let inv = null;
    if (inventoryId) inv = await this.getInventoryItem(inventoryId);
    else if (productId && warehouseId) inv = await this.getInventoryByProductWarehouse(productId, warehouseId);
    if (!inv) throw new Error('Inventory record not found');

    const oldQty = inv.quantity || 0;
    await this.db.collection('inventory').updateOne({ id: inv.id }, { $set: { quantity: Number(newQuantity), availableQuantity: Math.max(0, Number(newQuantity) - (inv.reservedQuantity || 0)), updatedAt: new Date(), lastUpdated: new Date() } });

    const txId = 'ITX-' + require('uuid').v4().substring(0, 8).toUpperCase();
    await this._recordInventoryTransaction({ id: txId, inventoryId: inv.id, type: 'ADJUSTMENT', quantity: Number(newQuantity) - Number(oldQty), reason, reference, performedBy });
    return await this.getInventoryItem(inv.id);
  }

  async getInventoryHistory(inventoryId, options = {}) {
    const filter = { inventoryId };
    const { page = 1, limit = 50 } = options;
    const skip = (Number(page) - 1) * Number(limit);
    const total = await this.db.collection('inventoryTransactions').countDocuments(filter);
    const items = await this.db.collection('inventoryTransactions').find(filter).sort({ createdAt: -1 }).skip(skip).limit(Number(limit)).toArray();
    return { total, page: Number(page), limit: Number(limit), items };
  }

  async getLowStock(threshold = 0) {
    // low stock: availableQuantity <= minimumStockLevel OR availableQuantity <= threshold
    const items = await this.db.collection('inventory').find({ $expr: { $lte: ['$availableQuantity', '$minimumStockLevel'] } }).toArray();
    return items;
  }

  async getOutOfStock() {
    const items = await this.db.collection('inventory').find({ availableQuantity: { $lte: 0 } }).toArray();
    return items;
  }

  async updateWarehouseStock(warehouseId, productId, newQuantity) {
    return await this.db.collection('warehouses').updateOne(
      { id: warehouseId },
      {
        $set: {
          [`currentStock.${productId}`]: newQuantity,
          updatedAt: new Date()
        }
      }
    );
  }

  // ========== CUSTOMER OPERATIONS ==========

  async getCustomers() {
    return await this.db.collection('customers').find({}).toArray();
  }

  async getCustomer(customerId) {
    return await this.db.collection('customers').findOne({ id: customerId });
  }

  // ========== PRODUCT OPERATIONS ==========

  async getProducts(options = {}) {
    const {
      page = 1,
      limit = 20,
      category,
      supplierId,
      status,
      search,
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = options;

    const filter = {};
    if (category) filter.category = category;
    if (supplierId) filter.supplierId = supplierId;
    if (status) filter.status = status;
    if (search) {
      const regex = new RegExp(search, 'i');
      filter.$or = [
        { name: regex },
        { sku: regex },
        { description: regex }
      ];
    }

    const skip = (Number(page) - 1) * Number(limit);
    const sort = { [sortBy]: sortOrder === 'asc' ? 1 : -1 };

    const [total, products] = await Promise.all([
      this.db.collection('products').countDocuments(filter),
      this.db.collection('products').find(filter).sort(sort).skip(skip).limit(Number(limit)).toArray()
    ]);

    return {
      total,
      page: Number(page),
      limit: Number(limit),
      products
    };
  }

  async getProduct(productId) {
    return await this.db.collection('products').findOne({ id: productId });
  }

  async getProductBySku(sku) {
    return await this.db.collection('products').findOne({ sku });
  }

  async addProduct(product) {
    return await this.db.collection('products').insertOne(product);
  }

  async updateProduct(productId, update) {
    return await this.db.collection('products').updateOne(
      { id: productId },
      { $set: update }
    );
  }

  async deleteProduct(productId, soft = true) {
    if (soft) {
      return await this.db.collection('products').updateOne(
        { id: productId },
        { $set: { status: 'INACTIVE', updatedAt: new Date() } }
      );
    }
    return await this.db.collection('products').deleteOne({ id: productId });
  }

  async searchProducts(query) {
    if (!query) return [];
    const regex = new RegExp(query, 'i');
    return await this.db.collection('products').find({
      $or: [{ name: regex }, { sku: regex }, { description: regex }]
    }).toArray();
  }

  // ========== SUPPLIER OPERATIONS ==========

  async getSuppliers(options = {}) {
    const {
      page = 1,
      limit = 20,
      status,
      search,
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = options;

    const filter = {};
    if (status) filter.status = status;
    if (search) {
      const regex = new RegExp(search, 'i');
      filter.$or = [
        { name: regex },
        { companyName: regex },
        { email: regex }
      ];
    }

    const skip = (Number(page) - 1) * Number(limit);
    const sort = { [sortBy]: sortOrder === 'asc' ? 1 : -1 };

    const [total, suppliers] = await Promise.all([
      this.db.collection('suppliers').countDocuments(filter),
      this.db.collection('suppliers').find(filter).sort(sort).skip(skip).limit(Number(limit)).toArray()
    ]);

    return { total, page: Number(page), limit: Number(limit), suppliers };
  }

  async getSupplier(supplierId) {
    return await this.db.collection('suppliers').findOne({ id: supplierId });
  }

  async addSupplier(supplier) {
    return await this.db.collection('suppliers').insertOne(supplier);
  }

  async updateSupplier(supplierId, update) {
    return await this.db.collection('suppliers').updateOne({ id: supplierId }, { $set: update });
  }

  async deleteSupplier(supplierId, soft = true) {
    if (soft) {
      return await this.db.collection('suppliers').updateOne({ id: supplierId }, { $set: { status: 'INACTIVE', updatedAt: new Date() } });
    }
    return await this.db.collection('suppliers').deleteOne({ id: supplierId });
  }

  async searchSuppliers(query) {
    if (!query) return [];
    const regex = new RegExp(query, 'i');
    return await this.db.collection('suppliers').find({ $or: [{ name: regex }, { companyName: regex }, { email: regex }] }).toArray();
  }

  async getProductsBySupplier(supplierId, options = {}) {
    const productOptions = { ...options, supplierId };
    return await this.getProducts(productOptions);
  }

  // ========== ORDER OPERATIONS ==========

  async addOrder(order) {
    const newOrder = {
      ...order,
      createdAt: new Date(),
      updatedAt: new Date(),
      status: 'pending'
    };
    const result = await this.db.collection('orders').insertOne(newOrder);
    return { ...newOrder, _id: result.insertedId };
  }

  async getOrder(orderId) {
    return await this.db.collection('orders').findOne({ id: orderId });
  }

  async getOrders(filter = {}) {
    return await this.db.collection('orders').find(filter).toArray();
  }

  async updateOrderStatus(orderId, status, allocatedWarehouse = null, cost = null) {
    const updateData = { updatedAt: new Date() };

    if (status) {
      updateData.status = status;
    }

    if (
      allocatedWarehouse &&
      typeof allocatedWarehouse === 'object' &&
      !Array.isArray(allocatedWarehouse)
    ) {
      Object.assign(updateData, allocatedWarehouse);
    } else {
      if (allocatedWarehouse) updateData.allocatedWarehouse = allocatedWarehouse;
      if (cost !== null && cost !== undefined) updateData.cost = cost;
    }

    return await this.db.collection('orders').updateOne(
      { id: orderId },
      { $set: updateData }
    );
  }

  async searchOrders(query) {
    const filter = {};
    if (query.customerId) filter.customerId = query.customerId;
    if (query.warehouseId) filter.allocatedWarehouse = query.warehouseId;
    if (query.status) filter.status = query.status;
    
    return await this.db.collection('orders').find(filter).toArray();
  }

  async getPendingOrders() {
    return await this.db.collection('orders').find({ status: 'pending' }).toArray();
  }

  // ========== DEMAND HISTORY OPERATIONS ==========

  async getDemandHistory(customerId, productId = null) {
    const filter = { customerId };
    if (productId) filter.productId = productId;

    const records = await this.db.collection('demandHistory')
      .find(filter)
      .sort({ day: 1, date: 1 })
      .toArray();

    if (productId) {
      return records.map((record) => record.quantity);
    }

    return records;
  }

  async getAllDemandHistory() {
    return await this.db.collection('demandHistory')
      .find({})
      .sort({ date: 1 })
      .toArray();
  }

  // ========== ORDER HISTORY OPERATIONS ==========

  async addToOrderHistory(order) {
    return await this.db.collection('ordersHistory').insertOne({
      ...order,
      createdAt: new Date(),
      completedAt: new Date()
    });
  }

  async getOrderHistory(filter = {}) {
    return await this.db.collection('ordersHistory').find(filter).toArray();
  }

  // ========== STATISTICS & AGGREGATIONS ==========

  async getStatistics() {
    const [orderCount, warehouseCount, customerCount] = await Promise.all([
      this.db.collection('orders').countDocuments(),
      this.db.collection('warehouses').countDocuments(),
      this.db.collection('customers').countDocuments()
    ]);

    // Get order status breakdown
    const orderStats = await this.db.collection('orders').aggregate([
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 }
        }
      }
    ]).toArray();

    // Calculate total stock and capacity
    const warehouseStats = await this.db.collection('warehouses').aggregate([
      {
        $group: {
          _id: null,
          totalCapacity: { $sum: '$capacity' },
          totalStock: { $sum: 0 }
        }
      }
    ]).toArray();

    const warehouses = await this.getWarehouses();
    const totalStock = warehouses.reduce(
      (sum, warehouse) => sum + Object.values(warehouse.currentStock || {}).reduce((acc, qty) => acc + qty, 0),
      0
    );

    return {
      totalOrders: orderCount,
      totalWarehouses: warehouseCount,
      totalCustomers: customerCount,
      ordersByStatus: orderStats,
      warehouse: {
        totalCapacity: warehouseStats[0]?.totalCapacity || 0,
        totalStock
      }
    };
  }

  // ========== BULK OPERATIONS ==========

  async clearAllData() {
    const collections = ['orders', 'ordersHistory', 'demandHistory'];
    for (const collName of collections) {
      await this.db.collection(collName).deleteMany({});
    }
    console.log('✓ Cleared all transaction data');
  }

  async resetToInitialState() {
    await this.clearAllData();
    await this.loadInitialDataFromJSON();
    console.log('✓ Reset to initial state');
  }
}

// Singleton instance
let dataManagerInstance = null;

function getDataManager() {
  if (!dataManagerInstance) {
    dataManagerInstance = new MongoDataManager();
  }
  return dataManagerInstance;
}

module.exports = {
  MongoDataManager,
  getDataManager
};
