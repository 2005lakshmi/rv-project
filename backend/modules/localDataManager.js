const fs = require('fs');
const path = require('path');

function readJson(fileName, fallback) {
  try {
    return JSON.parse(fs.readFileSync(path.join(__dirname, '../data', fileName), 'utf8'));
  } catch {
    return fallback;
  }
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function matchesFilter(item, filter = {}) {
  return Object.entries(filter).every(([key, expected]) => item[key] === expected);
}

function buildDemandRecords(demandHistory) {
  const records = [];
  for (const [customerId, productData] of Object.entries(demandHistory || {})) {
    for (const [productId, quantities] of Object.entries(productData || {})) {
      if (Array.isArray(quantities)) {
        quantities.forEach((quantity, day) => {
          records.push({ customerId, productId, quantity, day });
        });
      }
    }
  }
  return records;
}

class LocalDataManager {
  constructor() {
    this.warehouses = [];
    this.customers = [];
    this.products = [];
    this.suppliers = [];
    this.inventory = [];
    this.inventoryTransactions = [];
    this.transfers = [];
    this.orders = [];
    this.ordersHistory = [];
    this.demandHistory = {};
    this.initialized = false;
  }

  initialize() {
    this.loadInitialDataFromJSON();
    this.initialized = true;
    return this;
  }

  loadInitialDataFromJSON() {
    this.warehouses = readJson('warehouses.json', []);
    this.customers = readJson('customers.json', []);
    this.products = readJson('products.json', []);
    this.suppliers = readJson('suppliers.json', []);
    this.inventory = readJson('inventory.json', []);
    this.inventoryTransactions = readJson('inventory_transactions.json', []);
    this.transfers = readJson('transfers.json', []);
    this.orders = readJson('orders.json', []);
    this.ordersHistory = readJson('orders_history.json', []);
    this.demandHistory = readJson('demand_history.json', {});
    return this;
  }

  // Extended warehouse operations for local manager
  getWarehouses(options = {}) {
    const { page = 1, limit = 20, status, search, sortBy = 'createdAt', sortOrder = 'desc' } = options;
    let items = Array.isArray(this.warehouses) ? this.warehouses.slice() : [];
    if (status) items = items.filter(w => w.status === status);
    if (search) {
      const q = String(search).toLowerCase();
      items = items.filter(w => (w.name || '').toLowerCase().includes(q) || (w.code || '').toLowerCase().includes(q) || (w.address || '').toLowerCase().includes(q));
    }

    items.sort((a, b) => {
      const aVal = a[sortBy];
      const bVal = b[sortBy];
      if (aVal == null && bVal == null) return 0;
      if (aVal == null) return sortOrder === 'asc' ? -1 : 1;
      if (bVal == null) return sortOrder === 'asc' ? 1 : -1;
      if (aVal < bVal) return sortOrder === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortOrder === 'asc' ? 1 : -1;
      return 0;
    });

    const total = items.length;
    const start = (Number(page) - 1) * Number(limit);
    const paged = items.slice(start, start + Number(limit));

    return { total, page: Number(page), limit: Number(limit), warehouses: paged };
  }

  addWarehouse(warehouse) {
    this.warehouses.push({ ...warehouse });
    return warehouse;
  }

  updateWarehouse(warehouseId, update) {
    const idx = this.warehouses.findIndex(w => w.id === warehouseId);
    if (idx === -1) return { matchedCount: 0 };
    this.warehouses[idx] = { ...this.warehouses[idx], ...update };
    return { matchedCount: 1, modifiedCount: 1 };
  }

  deleteWarehouse(warehouseId, soft = true) {
    const idx = this.warehouses.findIndex(w => w.id === warehouseId);
    if (idx === -1) return { deletedCount: 0 };
    if (soft) {
      this.warehouses[idx].status = 'INACTIVE';
      this.warehouses[idx].updatedAt = new Date().toISOString();
      return { matchedCount: 1, modifiedCount: 1 };
    }
    this.warehouses.splice(idx, 1);
    return { deletedCount: 1 };
  }

  getWarehouseInventory(warehouseId) {
    const wh = this.getWarehouse(warehouseId);
    if (!wh) return null;
    return wh.currentStock || {};
  }

  // ========== SUPPLIER OPERATIONS (local/mock) ==========

  getSuppliers(options = {}) {
    const { page = 1, limit = 20, status, search, sortBy = 'createdAt', sortOrder = 'desc' } = options;
    let items = Array.isArray(this.suppliers) ? this.suppliers.slice() : [];
    if (status) items = items.filter(s => s.status === status);
    if (search) {
      const q = String(search).toLowerCase();
      items = items.filter(s => (s.name || '').toLowerCase().includes(q) || (s.companyName || '').toLowerCase().includes(q) || (s.email || '').toLowerCase().includes(q));
    }

    items.sort((a, b) => {
      const aVal = a[sortBy];
      const bVal = b[sortBy];
      if (aVal == null && bVal == null) return 0;
      if (aVal == null) return sortOrder === 'asc' ? -1 : 1;
      if (bVal == null) return sortOrder === 'asc' ? 1 : -1;
      if (aVal < bVal) return sortOrder === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortOrder === 'asc' ? 1 : -1;
      return 0;
    });

    const total = items.length;
    const start = (Number(page) - 1) * Number(limit);
    const paged = items.slice(start, start + Number(limit));

    return { total, page: Number(page), limit: Number(limit), suppliers: paged };
  }

  getSupplier(supplierId) {
    return this.suppliers.find(s => s.id === supplierId) || null;
  }

  addSupplier(supplier) {
    this.suppliers.push({ ...supplier });
    return supplier;
  }

  updateSupplier(supplierId, update) {
    const idx = this.suppliers.findIndex(s => s.id === supplierId);
    if (idx === -1) return { matchedCount: 0 };
    this.suppliers[idx] = { ...this.suppliers[idx], ...update };
    return { matchedCount: 1, modifiedCount: 1 };
  }

  deleteSupplier(supplierId, soft = true) {
    const idx = this.suppliers.findIndex(s => s.id === supplierId);
    if (idx === -1) return { deletedCount: 0 };
    if (soft) {
      this.suppliers[idx].status = 'INACTIVE';
      this.suppliers[idx].updatedAt = new Date().toISOString();
      return { matchedCount: 1, modifiedCount: 1 };
    }
    this.suppliers.splice(idx, 1);
    return { deletedCount: 1 };
  }

  searchSuppliers(query) {
    if (!query) return [];
    const q = String(query).toLowerCase();
    return this.suppliers.filter(s => (s.name || '').toLowerCase().includes(q) || (s.companyName || '').toLowerCase().includes(q) || (s.email || '').toLowerCase().includes(q));
  }

  getProductsBySupplier(supplierId, options = {}) {
    const prodOptions = { ...options, supplierId };
    return this.getProducts(prodOptions);
  }

  // ========== INVENTORY (local/mock) ==========

  getInventory(options = {}) {
    const { page = 1, limit = 50, warehouseId, productId, search, sortBy = 'lastUpdated', sortOrder = 'desc' } = options;
    let items = Array.isArray(this.inventory) ? this.inventory.slice() : [];
    if (warehouseId) items = items.filter(i => i.warehouseId === warehouseId);
    if (productId) items = items.filter(i => i.productId === productId);
    if (search) {
      const q = String(search).toLowerCase();
      items = items.filter(i => (i.id || '').toLowerCase().includes(q) || (i.productId || '').toLowerCase().includes(q));
    }

    items.sort((a, b) => {
      const aVal = a[sortBy];
      const bVal = b[sortBy];
      if (aVal == null && bVal == null) return 0;
      if (aVal == null) return sortOrder === 'asc' ? -1 : 1;
      if (bVal == null) return sortOrder === 'asc' ? 1 : -1;
      if (aVal < bVal) return sortOrder === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortOrder === 'asc' ? 1 : -1;
      return 0;
    });

    const total = items.length;
    const start = (Number(page) - 1) * Number(limit);
    const paged = items.slice(start, start + Number(limit));
    return { total, page: Number(page), limit: Number(limit), items: paged };
  }

  getInventoryItem(inventoryId) {
    return this.inventory.find(i => i.id === inventoryId) || null;
  }

  getInventoryByProductWarehouse(productId, warehouseId) {
    return this.inventory.find(i => i.productId === productId && i.warehouseId === warehouseId) || null;
  }

  _ensureInventoryFields(rec) {
    rec.quantity = Math.max(0, Number(rec.quantity || 0));
    rec.reservedQuantity = Math.max(0, Number(rec.reservedQuantity || 0));
    rec.availableQuantity = Math.max(0, rec.quantity - rec.reservedQuantity);
    rec.minimumStockLevel = Number(rec.minimumStockLevel || 0);
    rec.lastUpdated = rec.lastUpdated || new Date().toISOString();
    return rec;
  }

  addStock({ productId, warehouseId, quantity, minimumStockLevel = 0, performedBy = null, reason = '', reference = '' }) {
    if (Number(quantity) <= 0) throw new Error('Quantity must be positive');
    let inv = this.getInventoryByProductWarehouse(productId, warehouseId);
    if (!inv) {
      inv = {
        id: 'INV-' + require('uuid').v4().substring(0, 8).toUpperCase(),
        productId,
        warehouseId,
        quantity: Number(quantity),
        reservedQuantity: 0,
        minimumStockLevel: Number(minimumStockLevel),
        lastUpdated: new Date().toISOString(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      inv.availableQuantity = Math.max(0, inv.quantity - inv.reservedQuantity);
      this.inventory.push(inv);
    } else {
      inv.quantity = Math.max(0, inv.quantity + Number(quantity));
      inv.availableQuantity = Math.max(0, inv.quantity - inv.reservedQuantity);
      inv.updatedAt = new Date().toISOString();
      inv.lastUpdated = new Date().toISOString();
    }

    const tx = {
      id: 'ITX-' + require('uuid').v4().substring(0, 8).toUpperCase(),
      inventoryId: inv.id,
      type: 'STOCK_IN',
      quantity: Number(quantity),
      reason,
      reference,
      performedBy,
      createdAt: new Date().toISOString()
    };
    this.inventoryTransactions.push(tx);
    return inv;
  }

  removeStock({ inventoryId, productId, warehouseId, quantity, performedBy = null, reason = '', reference = '' }) {
    if (Number(quantity) <= 0) throw new Error('Quantity must be positive');
    let inv = null;
    if (inventoryId) inv = this.getInventoryItem(inventoryId);
    else if (productId && warehouseId) inv = this.getInventoryByProductWarehouse(productId, warehouseId);
    if (!inv) throw new Error('Inventory not found');
    const available = inv.quantity - (inv.reservedQuantity || 0);
    if (available < Number(quantity)) throw new Error('Insufficient available stock');
    inv.quantity = Math.max(0, inv.quantity - Number(quantity));
    inv.availableQuantity = Math.max(0, inv.quantity - inv.reservedQuantity);
    inv.updatedAt = new Date().toISOString();
    inv.lastUpdated = new Date().toISOString();

    const tx = {
      id: 'ITX-' + require('uuid').v4().substring(0, 8).toUpperCase(),
      inventoryId: inv.id,
      type: 'STOCK_OUT',
      quantity: Number(quantity),
      reason,
      reference,
      performedBy,
      createdAt: new Date().toISOString()
    };
    this.inventoryTransactions.push(tx);
    return inv;
  }

  adjustStock({ inventoryId, productId, warehouseId, newQuantity, performedBy = null, reason = '', reference = '' }) {
    if (newQuantity == null || Number(newQuantity) < 0) throw new Error('newQuantity must be >= 0');
    let inv = null;
    if (inventoryId) inv = this.getInventoryItem(inventoryId);
    else if (productId && warehouseId) inv = this.getInventoryByProductWarehouse(productId, warehouseId);
    if (!inv) throw new Error('Inventory not found');
    const oldQty = inv.quantity;
    inv.quantity = Math.max(0, Number(newQuantity));
    inv.availableQuantity = Math.max(0, inv.quantity - (inv.reservedQuantity || 0));
    inv.updatedAt = new Date().toISOString();
    inv.lastUpdated = new Date().toISOString();

    const tx = {
      id: 'ITX-' + require('uuid').v4().substring(0, 8).toUpperCase(),
      inventoryId: inv.id,
      type: 'ADJUSTMENT',
      quantity: Number(newQuantity) - Number(oldQty),
      reason,
      reference,
      performedBy,
      createdAt: new Date().toISOString()
    };
    this.inventoryTransactions.push(tx);
    return inv;
  }

  getInventoryHistory(inventoryId, options = {}) {
    const { page = 1, limit = 50 } = options;
    const items = this.inventoryTransactions.filter(t => t.inventoryId === inventoryId).sort((a,b)=> new Date(b.createdAt) - new Date(a.createdAt));
    const total = items.length;
    const start = (Number(page) - 1) * Number(limit);
    return { total, page: Number(page), limit: Number(limit), items: items.slice(start, start + Number(limit)) };
  }

  getLowStock(threshold = 0) {
    return this.inventory.filter(i => (i.availableQuantity || 0) <= (i.minimumStockLevel || 0) || (i.availableQuantity || 0) <= threshold);
  }

  getOutOfStock() {
    return this.inventory.filter(i => (i.availableQuantity || 0) <= 0);
  }

  // ========== TRANSFERS (local/mock) ==========

  createTransfer({ productId, sourceWarehouseId, destinationWarehouseId, quantity, createdBy = null, reference = '' }) {
    if (!productId || !sourceWarehouseId || !destinationWarehouseId || !quantity) throw new Error('Missing required fields');
    if (sourceWarehouseId === destinationWarehouseId) throw new Error('Source and destination must differ');
    if (Number(quantity) <= 0) throw new Error('Quantity must be positive');

    const sourceInv = this.getInventoryByProductWarehouse(productId, sourceWarehouseId);
    if (!sourceInv) throw new Error('Source inventory not found');
    const available = (sourceInv.quantity || 0) - (sourceInv.reservedQuantity || 0);
    if (available < Number(quantity)) throw new Error('Insufficient available stock');

    let destInv = this.getInventoryByProductWarehouse(productId, destinationWarehouseId);
    if (!destInv) {
      destInv = {
        id: 'INV-' + require('uuid').v4().substring(0, 8).toUpperCase(),
        productId,
        warehouseId: destinationWarehouseId,
        quantity: 0,
        reservedQuantity: 0,
        availableQuantity: 0,
        minimumStockLevel: 0,
        lastUpdated: new Date().toISOString(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      this.inventory.push(destInv);
    }

    // Move stock
    sourceInv.quantity = Math.max(0, sourceInv.quantity - Number(quantity));
    sourceInv.availableQuantity = Math.max(0, sourceInv.quantity - sourceInv.reservedQuantity);
    sourceInv.updatedAt = new Date().toISOString();

    destInv.quantity = Math.max(0, destInv.quantity + Number(quantity));
    destInv.availableQuantity = Math.max(0, destInv.quantity - destInv.reservedQuantity);
    destInv.updatedAt = new Date().toISOString();

    const transfer = {
      id: 'TR-' + require('uuid').v4().substring(0, 8).toUpperCase(),
      productId,
      sourceWarehouseId,
      destinationWarehouseId,
      quantity: Number(quantity),
      status: 'COMPLETED',
      createdBy,
      reference,
      createdAt: new Date().toISOString()
    };
    this.transfers.push(transfer);

    const txOut = {
      id: 'ITX-' + require('uuid').v4().substring(0, 8).toUpperCase(),
      inventoryId: sourceInv.id,
      type: 'TRANSFER_OUT',
      quantity: Number(quantity),
      reason: 'Warehouse transfer',
      reference: transfer.id,
      performedBy: createdBy,
      createdAt: new Date().toISOString()
    };
    const txIn = {
      id: 'ITX-' + require('uuid').v4().substring(0, 8).toUpperCase(),
      inventoryId: destInv.id,
      type: 'TRANSFER_IN',
      quantity: Number(quantity),
      reason: 'Warehouse transfer',
      reference: transfer.id,
      performedBy: createdBy,
      createdAt: new Date().toISOString()
    };
    this.inventoryTransactions.push(txOut, txIn);

    return transfer;
  }

  getTransfers(filter = {}) {
    return this.transfers.filter(t => {
      return Object.entries(filter).every(([k, v]) => t[k] === v);
    });
  }

  getTransfer(transferId) {
    return this.transfers.find(t => t.id === transferId) || null;
  }

  // ========== PRODUCT OPERATIONS (local/mock) ==========

  getProducts(options = {}) {
    const { page = 1, limit = 20, category, status, search, sortBy = 'createdAt', sortOrder = 'desc' } = options;
    let items = Array.isArray(this.products) ? this.products.slice() : [];
    if (category) items = items.filter(p => p.category === category);
    if (status) items = items.filter(p => p.status === status);
    if (search) {
      const q = String(search).toLowerCase();
      items = items.filter(p => (p.name || '').toLowerCase().includes(q) || (p.sku || '').toLowerCase().includes(q) || (p.description || '').toLowerCase().includes(q));
    }

    items.sort((a, b) => {
      const aVal = a[sortBy];
      const bVal = b[sortBy];
      if (aVal == null && bVal == null) return 0;
      if (aVal == null) return sortOrder === 'asc' ? -1 : 1;
      if (bVal == null) return sortOrder === 'asc' ? 1 : -1;
      if (aVal < bVal) return sortOrder === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortOrder === 'asc' ? 1 : -1;
      return 0;
    });

    const total = items.length;
    const start = (Number(page) - 1) * Number(limit);
    const paged = items.slice(start, start + Number(limit));

    return { total, page: Number(page), limit: Number(limit), products: paged };
  }

  getProduct(productId) {
    return this.products.find(p => p.id === productId) || null;
  }

  getProductBySku(sku) {
    return this.products.find(p => p.sku === sku) || null;
  }

  addProduct(product) {
    this.products.push({ ...product });
    return product;
  }

  updateProduct(productId, update) {
    const idx = this.products.findIndex(p => p.id === productId);
    if (idx === -1) return { matchedCount: 0 };
    this.products[idx] = { ...this.products[idx], ...update };
    return { matchedCount: 1, modifiedCount: 1 };
  }

  deleteProduct(productId, soft = true) {
    const idx = this.products.findIndex(p => p.id === productId);
    if (idx === -1) return { deletedCount: 0 };
    if (soft) {
      this.products[idx].status = 'INACTIVE';
      this.products[idx].updatedAt = new Date().toISOString();
      return { matchedCount: 1, modifiedCount: 1 };
    }
    this.products.splice(idx, 1);
    return { deletedCount: 1 };
  }

  searchProducts(query) {
    if (!query) return [];
    const q = String(query).toLowerCase();
    return this.products.filter(p => (p.name || '').toLowerCase().includes(q) || (p.sku || '').toLowerCase().includes(q) || (p.description || '').toLowerCase().includes(q));
  }

  getWarehouses() {
    return this.warehouses;
  }

  getWarehouse(warehouseId) {
    return this.warehouses.find((warehouse) => warehouse.id === warehouseId) || null;
  }

  updateWarehouseStock(warehouseId, productId, newQuantity) {
    const warehouse = this.getWarehouse(warehouseId);
    if (!warehouse) {
      return { matchedCount: 0, modifiedCount: 0 };
    }

    warehouse.currentStock = warehouse.currentStock || {};
    warehouse.currentStock[productId] = newQuantity;
    warehouse.updatedAt = new Date().toISOString();
    return { matchedCount: 1, modifiedCount: 1 };
  }

  getCustomers() {
    return this.customers;
  }

  getCustomer(customerId) {
    return this.customers.find((customer) => customer.id === customerId) || null;
  }

  addOrder(order) {
    const newOrder = {
      ...clone(order),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      status: order.status || 'pending'
    };

    this.orders.push(newOrder);
    return newOrder;
  }

  getOrder(orderId) {
    return this.orders.find((order) => order.id === orderId) || null;
  }

  getOrders(filter = {}) {
    return this.orders.filter((order) => {
      if (filter.customerId && order.customerId !== filter.customerId) return false;
      if (filter.warehouseId && order.assignedWarehouse !== filter.warehouseId) return false;
      if (filter.status && order.status !== filter.status) return false;
      return true;
    });
  }

  updateOrderStatus(orderId, status, allocatedWarehouse = null, cost = null) {
    const order = this.getOrder(orderId);
    if (!order) {
      return { matchedCount: 0, modifiedCount: 0 };
    }

    const updateData = { updatedAt: new Date().toISOString() };

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
      if (allocatedWarehouse) updateData.assignedWarehouse = allocatedWarehouse;
      if (cost !== null && cost !== undefined) updateData.cost = cost;
    }

    Object.assign(order, updateData);
    return { matchedCount: 1, modifiedCount: 1 };
  }

  searchOrders(query) {
    return this.orders.filter((order) => {
      if (query.customerId && order.customerId !== query.customerId) return false;
      if (query.warehouseId && order.assignedWarehouse !== query.warehouseId) return false;
      if (query.status && order.status !== query.status) return false;
      return true;
    });
  }

  getPendingOrders() {
    return this.orders.filter((order) => order.status === 'pending');
  }

  getDemandHistory(customerId, productId = null) {
    const customerDemand = this.demandHistory[customerId] || {};
    if (productId) {
      return customerDemand[productId] || [];
    }
    return customerDemand;
  }

  getAllDemandHistory() {
    return buildDemandRecords(this.demandHistory);
  }

  addToOrderHistory(order) {
    const record = {
      ...clone(order),
      createdAt: new Date().toISOString(),
      completedAt: new Date().toISOString()
    };
    this.ordersHistory.push(record);
    return record;
  }

  getOrderHistory(filter = {}) {
    return this.ordersHistory.filter((order) => matchesFilter(order, filter));
  }

  getStatistics() {
    const orderCount = this.orders.length;
    const warehouseCount = this.warehouses.length;
    const customerCount = this.customers.length;

    const statusCounts = this.orders.reduce((acc, order) => {
      const key = order.status || 'unknown';
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {});

    const totalCapacity = this.warehouses.reduce((sum, warehouse) => sum + (warehouse.capacity || 0), 0);
    const totalStock = this.warehouses.reduce((sum, warehouse) => {
      return sum + Object.values(warehouse.currentStock || {}).reduce((stockSum, quantity) => stockSum + quantity, 0);
    }, 0);

    return {
      totalOrders: orderCount,
      totalWarehouses: warehouseCount,
      totalCustomers: customerCount,
      ordersByStatus: Object.entries(statusCounts).map(([status, count]) => ({
        _id: status,
        count
      })),
      warehouse: {
        totalCapacity,
        totalStock
      }
    };
  }

  clearAllData() {
    this.orders = [];
    this.ordersHistory = [];
    this.demandHistory = {};
    return { cleared: true };
  }

  resetToInitialState() {
    this.loadInitialDataFromJSON();
    return { reset: true };
  }
}

let localDataManagerInstance = null;

function getLocalDataManager() {
  if (!localDataManagerInstance) {
    localDataManagerInstance = new LocalDataManager();
  }
  return localDataManagerInstance;
}

module.exports = {
  LocalDataManager,
  getLocalDataManager
};
