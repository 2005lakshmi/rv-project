const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { getDB } = require('../config/database');

const COLLECTION_NAME = 'users';

function normalizeUser(user) {
  if (!user) return null;
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role || 'ADMIN',
    status: user.status || 'ACTIVE',
    passwordHash: user.passwordHash || user.password_hash || '',
    createdAt: user.createdAt || user.created_at || new Date().toISOString(),
    updatedAt: user.updatedAt || user.updated_at || new Date().toISOString(),
  };
}

async function ensureUserCollections() {
  const db = getDB();
  if (!db) return;

  await db.collection(COLLECTION_NAME).createIndex({ email: 1 }, { unique: true });
  await db.collection(COLLECTION_NAME).createIndex({ role: 1, status: 1 });
}

async function findUserByEmail(email) {
  const db = getDB();
  if (!db) return null;
  const user = await db.collection(COLLECTION_NAME).findOne({ email: String(email).trim().toLowerCase() });
  return normalizeUser(user);
}

async function findUserById(id) {
  const db = getDB();
  if (!db) return null;
  const user = await db.collection(COLLECTION_NAME).findOne({ id });
  return normalizeUser(user);
}

async function createUser({ name, email, password, role = 'ADMIN', status = 'ACTIVE' }) {
  const db = getDB();
  if (!db) throw new Error('Database unavailable');

  const existing = await findUserByEmail(email);
  if (existing) {
    throw new Error('User with this email already exists');
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const now = new Date().toISOString();
  const user = {
    id: `USR-${Date.now()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`,
    name: String(name).trim(),
    email: String(email).trim().toLowerCase(),
    passwordHash,
    role,
    status,
    createdAt: now,
    updatedAt: now,
  };

  await db.collection(COLLECTION_NAME).insertOne(user);
  return normalizeUser(user);
}

async function listUsers() {
  const db = getDB();
  if (!db) return [];
  const docs = await db.collection(COLLECTION_NAME).find({}).sort({ createdAt: -1 }).toArray();
  return docs.map(normalizeUser);
}

async function updateUserById(id, payload = {}) {
  const db = getDB();
  if (!db) return null;

  const update = {
    ...payload,
    updatedAt: new Date().toISOString(),
  };

  await db.collection(COLLECTION_NAME).updateOne({ id }, { $set: update });
  return await findUserById(id);
}

async function deleteUserById(id) {
  const db = getDB();
  if (!db) return false;
  const result = await db.collection(COLLECTION_NAME).deleteOne({ id });
  return result.deletedCount > 0;
}

function signToken(user) {
  return jwt.sign(
    {
      id: user.id,
      email: user.email,
      role: user.role,
      name: user.name
    },
    process.env.JWT_SECRET || 'supply-chain-dev-secret',
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
  );
}

async function comparePassword(plainPassword, hashedPassword) {
  return bcrypt.compare(plainPassword, hashedPassword);
}

async function getDashboardStats() {
  const db = getDB();
  if (!db) {
    return {
      totalUsers: 0,
      totalSuppliers: 0,
      totalProducts: 0,
      totalWarehouses: 0,
      totalInventory: 0,
      lowStockProducts: 0,
    };
  }

  const users = await db.collection(COLLECTION_NAME).countDocuments();
  const warehouses = await db.collection('warehouses').countDocuments();
  const products = await db.collection('products').countDocuments();
  const suppliers = await db.collection('suppliers').countDocuments();

  const inventoryCount = await db.collection('inventory').countDocuments();
  const lowStockCount = await db.collection('inventory').countDocuments({ $expr: { $lte: ['$availableQuantity', '$minimumStockLevel'] } });

  // Recent items
  const recentInventoryTx = await db.collection('inventoryTransactions').find({}).sort({ createdAt: -1 }).limit(10).toArray();
  const recentProducts = await db.collection('products').find({}).sort({ createdAt: -1 }).limit(10).toArray();
  const recentSuppliers = await db.collection('suppliers').find({}).sort({ createdAt: -1 }).limit(10).toArray();
  const recentTransfers = await db.collection('transfers').find({}).sort({ createdAt: -1 }).limit(10).toArray();

  // Inventory by warehouse
  const inventoryByWarehouseAgg = await db.collection('inventory').aggregate([
    { $group: { _id: '$warehouseId', totalQuantity: { $sum: '$quantity' }, totalAvailable: { $sum: '$availableQuantity' } } },
    { $sort: { totalAvailable: -1 } }
  ]).toArray();

  // Products by category
  const productsByCategoryAgg = await db.collection('products').aggregate([
    { $group: { _id: '$category', count: { $sum: 1 } } },
    { $sort: { count: -1 } }
  ]).toArray();

  // Low stock and out-of-stock lists (limit)
  const lowStockItems = await db.collection('inventory').find({ $expr: { $lte: ['$availableQuantity', '$minimumStockLevel'] } }).sort({ availableQuantity: 1 }).limit(10).toArray();
  const outOfStockItems = await db.collection('inventory').find({ availableQuantity: { $lte: 0 } }).sort({ updatedAt: -1 }).limit(10).toArray();

  // Inventory movement over time (last 30 days aggregated)
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 29);
  const movementAgg = await db.collection('inventoryTransactions').aggregate([
    { $match: { createdAt: { $gte: thirtyDaysAgo } } },
    { $project: { date: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } }, type: '$type', quantity: '$quantity' } },
    { $group: { _id: { date: '$date', type: '$type' }, totalQty: { $sum: '$quantity' } } },
    { $group: { _id: '$_id.date', types: { $push: { type: '$_id.type', totalQty: '$totalQty' } }, total: { $sum: '$totalQty' } } },
    { $sort: { _id: 1 } }
  ]).toArray();

  return {
    totalUsers: users,
    totalSuppliers: suppliers,
    totalProducts: products,
    totalWarehouses: warehouses,
    totalInventory: inventoryCount,
    lowStockProducts: lowStockCount,
    inventoryByWarehouse: inventoryByWarehouseAgg,
    productsByCategory: productsByCategoryAgg,
    lowStockItems,
    outOfStockItems,
    recentInventoryTransactions: recentInventoryTx,
    recentProducts,
    recentSuppliers,
    recentTransfers,
    inventoryMovementOverTime: movementAgg
  };
}

module.exports = {
  ensureUserCollections,
  createUser,
  findUserByEmail,
  findUserById,
  listUsers,
  updateUserById,
  deleteUserById,
  signToken,
  comparePassword,
  getDashboardStats,
};
