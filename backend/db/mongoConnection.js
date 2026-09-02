// MongoDB connection utility
// Optimized for development/hackathon environment (single instance, reusable client)

const { MongoClient } = require('mongodb');

// Connection configuration following best practices for demo/hackathon environments
const mongoConfig = {
  url: process.env.MONGODB_URL || 'mongodb://localhost:27017',
  dbName: process.env.DB_NAME || 'logistics_optimization',
  
  // Connection pool optimized for development (small pool, quick responses)
  options: {
    maxPoolSize: 5,           // Small pool for development
    minPoolSize: 1,           // Minimal connections at startup
    maxIdleTimeMS: 30000,     // Close idle connections after 30s
    connectTimeoutMS: 5000,   // Fail fast if can't connect
    serverSelectionTimeoutMS: 5000,
    socketTimeoutMS: 45000,
    retryWrites: true,
    retryReads: true,
  }
};

let mongoClient = null;
let db = null;

/**
 * Connect to MongoDB
 * Creates a single reusable connection for the application
 */
async function connectDB() {
  try {
    if (mongoClient && mongoClient.topology && mongoClient.topology.isConnected()) {
      console.log('✓ Using existing MongoDB connection');
      return db;
    }

    console.log(`🔌 Connecting to MongoDB: ${mongoConfig.url}/${mongoConfig.dbName}`);
    
    mongoClient = new MongoClient(mongoConfig.url, mongoConfig.options);
    await mongoClient.connect();
    
    db = mongoClient.db(mongoConfig.dbName);
    
    // Test connection
    const adminDb = db.admin();
    const status = await adminDb.ping();
    
    console.log('✅ MongoDB connected successfully');
    console.log(`📦 Database: ${mongoConfig.dbName}`);
    
    return db;
    
  } catch (error) {
    console.error('❌ MongoDB connection failed:', error.message);
    throw error;
  }
}

/**
 * Get MongoDB database instance
 */
function getDB() {
  if (!db) {
    throw new Error('Database not initialized. Call connectDB() first.');
  }
  return db;
}

/**
 * Get MongoDB client instance
 */
function getClient() {
  if (!mongoClient) {
    throw new Error('MongoDB client not initialized. Call connectDB() first.');
  }
  return mongoClient;
}

/**
 * Disconnect from MongoDB
 */
async function disconnectDB() {
  try {
    if (mongoClient) {
      await mongoClient.close();
      console.log('🔌 MongoDB disconnected');
      mongoClient = null;
      db = null;
    }
  } catch (error) {
    console.error('Error disconnecting MongoDB:', error);
  }
}

/**
 * Initialize collections with schema validation
 */
async function initializeCollections() {
  const database = getDB();
  
  try {
    // Drop existing collections to remove old validators (but NOT orders - preserve user data)
    const collectionsToReset = [
      'warehouses',
      'customers',
      'demandHistory',
      'ordersHistory',
      'products',
      'suppliers'
      , 'inventory', 'inventoryTransactions', 'transfers'
    ];

    for (const collName of collectionsToReset) {
      try {
        await database.dropCollection(collName);
        console.log(`✓ Dropped old collection "${collName}"`);
      } catch (err) {
        // Collection doesn't exist, that's fine
      }
    }

    // Create fresh collections without strict validation
    const collectionsToCreate = [
      'warehouses',
      'customers',
      'orders',
      'products',
      'suppliers',
      'inventory',
      'inventoryTransactions',
      'transfers',
      'demandHistory',
      'ordersHistory'
    ];

    for (const collName of collectionsToCreate) {
      try {
        await database.createCollection(collName);
        console.log(`✓ Collection "${collName}" created`);
      } catch (err) {
        if (err.codeName === 'NamespaceExists') {
          // Collection already exists, try to remove its validator
          console.log(`✓ Collection "${collName}" already exists, removing validator...`);
          try {
            await database.command({
              collMod: collName,
              validator: {}  // Empty validator = no validation
            });
            console.log(`✓ Removed validator from "${collName}"`);
          } catch (modErr) {
            // Validator removal might fail if none exists, that's fine
          }
        } else {
          throw err;
        }
      }
    }

    // Create indexes for performance
    const collections = {
      warehouses: [{ id: 1 }],
      customers: [{ id: 1 }],
      orders: [
        { id: 1 },
        { customerId: 1 },
        { status: 1 },
        { requiredDate: 1 }
      ],
        products: [
          { id: 1 },
          { sku: 1 }
        ],
        suppliers: [
          { id: 1 },
          { email: 1 }
        ],
        inventory: [
          { id: 1 },
          { productId: 1 },
          { warehouseId: 1 }
        ],
        inventoryTransactions: [
          { id: 1 },
          { inventoryId: 1 },
          { type: 1 }
        ],
        transfers: [
          { id: 1 },
          { sourceWarehouseId: 1 },
          { destinationWarehouseId: 1 },
          { status: 1 }
        ],
      demandHistory: [
        { customerId: 1, date: 1 },
        { productId: 1, date: 1 }
      ],
      ordersHistory: [
        { id: 1 },
        { customerId: 1 },
        { status: 1 }
      ]
    };

    for (const [collName, indexes] of Object.entries(collections)) {
      const coll = database.collection(collName);
      for (const indexSpec of indexes) {
        try {
          // Make sku, supplier email, and warehouse code unique when creating indexes
          const keys = Object.keys(indexSpec || {});
          const shouldUnique = keys.includes('sku') || keys.includes('email') || keys.includes('code');
          const options = shouldUnique ? { unique: true } : {};
          await coll.createIndex(indexSpec, options);
        } catch (err) {
          // Index might already exist
        }
      }
    }

    console.log('✓ Collections and indexes initialized');
    
  } catch (error) {
    console.error('Error initializing collections:', error.message);
    throw error;
  }
}

module.exports = {
  connectDB,
  getDB,
  getClient,
  disconnectDB,
  initializeCollections,
  mongoConfig
};
