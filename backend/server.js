// Main Express Server for Logistics System
// Now with MongoDB integration instead of JSON files

const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const config = require('./config');
const { connectDB, initializeCollections, disconnectDB } = require('./db/mongoConnection');
const { getDataManager: getMongoDataManager } = require('./modules/mongoDataManager');
const { getLocalDataManager } = require('./modules/localDataManager');
const { buildDistanceMatrix } = require('./utils/distance');
const KPITracker = require('./modules/kpiTracker');
const GeminiAI = require('./modules/geminiAI');

// Initialize app
const app = express();
let dataManager = null;

function getDataManager() {
  if (!dataManager) {
    dataManager = config.useMockData ? getLocalDataManager() : getMongoDataManager();
  }
  return dataManager;
}

// Middleware
app.use(cors());
app.use(bodyParser.json({ limit: '50mb' }));
app.use(bodyParser.urlencoded({ limit: '50mb', extended: true }));

// Request logging middleware
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();
});

app.use('/api/auth', require('./src/routes/authRoutes'));
app.use('/api/admin', require('./src/routes/adminRoutes'));

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: config.env,
    database: config.useMockData ? 'local-mock' : 'mongodb'
  });
});

app.get('/api/maps/route', async (req, res) => {
  try {
    const { origin, destination, mode = 'driving' } = req.query;

    if (!origin || !destination) {
      return res.status(400).json({
        error: 'origin and destination query parameters are required'
      });
    }

    const parseCoordinate = (value) => {
      const parts = String(value).split(',').map((item) => Number(item.trim()));
      if (parts.length !== 2 || parts.some(Number.isNaN)) {
        return null;
      }
      const [lat, lon] = parts;
      return { lat, lon };
    };

    const originCoords = parseCoordinate(origin);
    const destinationCoords = parseCoordinate(destination);

    if (!originCoords || !destinationCoords) {
      return res.status(400).json({
        error: 'origin and destination must be in latitude,longitude format'
      });
    }

    const osrmUrl = new URL('https://router.project-osrm.org/route/v1/driving/' +
      `${originCoords.lon},${originCoords.lat};${destinationCoords.lon},${destinationCoords.lat}`);
    osrmUrl.searchParams.set('overview', 'full');
    osrmUrl.searchParams.set('geometries', 'geojson');

    const response = await fetch(osrmUrl.toString());
    const data = await response.json();

    if (!response.ok || data.code !== 'Ok') {
      return res.status(502).json({
        error: 'OSRM route request failed',
        details: data.message || data.code || 'Unknown error'
      });
    }

    const route = data.routes?.[0];
    if (!route) {
      return res.status(404).json({ error: 'No route found between origin and destination' });
    }

    res.json({
      status: 'ok',
      provider: 'openstreetmap-osrm',
      origin: String(origin),
      destination: String(destination),
      mode: String(mode),
      summary: route.summary || 'Route found',
      distance: route.distance ?? null,
      duration: route.duration ?? null,
      geometry: route.geometry || null,
      legs: route.legs || [],
      raw: data
    });
  } catch (error) {
    console.error('OSRM route error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ============ WAREHOUSE ENDPOINTS ============
app.get('/api/warehouses', async (req, res) => {
  try {
    const dataManager = getDataManager();
    const warehouses = await dataManager.getWarehouses();
    res.json(warehouses);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/warehouses/:id', async (req, res) => {
  try {
    const dataManager = getDataManager();
    const warehouse = await dataManager.getWarehouse(req.params.id);
    if (!warehouse) {
      return res.status(404).json({ error: 'Warehouse not found' });
    }
    res.json(warehouse);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============ CUSTOMER ENDPOINTS ============
app.get('/api/customers', async (req, res) => {
  try {
    const dataManager = getDataManager();
    const customers = await dataManager.getCustomers();
    res.json(customers);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/customers/:id', async (req, res) => {
  try {
    const dataManager = getDataManager();
    const customer = await dataManager.getCustomer(req.params.id);
    if (!customer) {
      return res.status(404).json({ error: 'Customer not found' });
    }
    res.json(customer);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/customers/:id/demand', async (req, res) => {
  try {
    const dataManager = getDataManager();
    const customerId = req.params.id;
    const demandHistory = await dataManager.getDemandHistory(customerId);
    
    res.json({
      customerId,
      demand: demandHistory
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============ ROUTE INTEGRATION ============
// Middleware to inject dataManager into all requests
app.use('/api/', (req, res, next) => {
  req.dataManager = getDataManager();
  next();
});

// Routes will be mounted after dataManager is initialized (in startServer)
let routesInitialized = false;
let errorHandlersInitialized = false;

// ============ STATISTICS ENDPOINT ============
app.get('/api/statistics', async (req, res) => {
  try {
    const dataManager = getDataManager();
    const stats = await dataManager.getStatistics();
    res.json(stats);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============ DATA ENDPOINTS ============
app.get('/api/data', async (req, res) => {
  try {
    const dataManager = getDataManager();
    const stats = await dataManager.getStatistics();
    res.json({
      warehouses: stats.totalWarehouses,
      customers: stats.totalCustomers,
      orders: stats.totalOrders
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============ SERVER STARTUP ============
const PORT = config.port;

async function startServer() {
  try {
    console.log('\n╔════════════════════════════════════════════════════════════╗');
    console.log('║   🚀 Logistics & Supply Chain Optimization System         ║');
    console.log('║      Starting with MongoDB...                             ║');
    console.log('╚════════════════════════════════════════════════════════════╝\n');

    // Connect to MongoDB only when mock data is disabled
    if (!config.useMockData) {
      console.log('🔌 Connecting to MongoDB...');
      await connectDB();

      console.log('📚 Initializing collections and indexes...');
      await initializeCollections();

      try {
        const { createUser } = require('./src/services/authService');
        await createUser({
          name: 'System Admin',
          email: 'admin@logistics.com',
          password: 'Admin@1234',
          role: 'ADMIN',
          status: 'ACTIVE'
        });
        console.log('✅ Default admin account created: admin@logistics.com / Admin@1234');
      } catch (error) {
        if (!String(error.message).toLowerCase().includes('already exists')) {
          console.warn('Admin seed warning:', error.message);
        }
      }
    } else {
      console.log('🧪 Using mock data - skipping MongoDB connection');
    }

    // Initialize data manager
    console.log('📥 Initializing data manager...');
    const dataManager = getDataManager();
    await dataManager.initialize();

    // Get statistics
    const stats = await dataManager.getStatistics();

    // Initialize routes after dataManager is ready
    if (!routesInitialized) {
      const orderRoutes = require('./routes/orders');
      const forecastRoutes = require('./routes/forecast');
      const optimizeRoutes = require('./routes/optimize');
      const allocateRoutes = require('./routes/allocate');
      const disruptionRoutes = require('./routes/disruption');
      const driverRoutes = require('./routes/driver');
      const dashboardRoutes = require('./routes/dashboard');
      const productRoutes = require('./routes/products');
      const supplierRoutes = require('./routes/suppliers');
      const warehouseRoutes = require('./routes/warehouses');
      const inventoryRoutes = require('./routes/inventory');
      const transferRoutes = require('./routes/transfers');

      const kpiTracker = new KPITracker();
      const geminiAI = new GeminiAI({
        apiKey: config.apis.gemini,
        model: config.apis.geminiModel
      });
      const warehouses = await dataManager.getWarehouses();
      const customers = await dataManager.getCustomers();
      const distanceMatrix = buildDistanceMatrix(warehouses, customers);

      app.use('/api/orders', orderRoutes(dataManager, kpiTracker, distanceMatrix, config));
      app.use('/api/forecast', forecastRoutes(dataManager, kpiTracker, distanceMatrix, config));
      app.use('/api/optimize', optimizeRoutes(dataManager, kpiTracker, distanceMatrix, config));
      app.use('/api/allocate', allocateRoutes(dataManager, kpiTracker, distanceMatrix, config));
      app.use('/api/disruption', disruptionRoutes(dataManager, kpiTracker, distanceMatrix, config, geminiAI));
      app.use('/api/driver', driverRoutes(dataManager, geminiAI));
      app.use('/api/dashboard', dashboardRoutes(dataManager, kpiTracker, distanceMatrix, config));
      app.use('/api/products', productRoutes(dataManager));
      app.use('/api/suppliers', supplierRoutes(dataManager));
      app.use('/api/warehouses', warehouseRoutes(dataManager));
      app.use('/api/inventory', inventoryRoutes(dataManager));
      app.use('/api/transfers', transferRoutes(dataManager));
      
      // Initialize Gemini AI and add AI routes
      const aiRoutes = require('./routes/ai');
      app.use('/api/ai', aiRoutes(dataManager, geminiAI));
      
      console.log(
        geminiAI.isConfigured
          ? `✅ AI routes initialized with Gemini (${config.apis.geminiModel})`
          : '⚠️ AI routes initialized in fallback mode - GEMINI_API_KEY not set'
      );
      
      routesInitialized = true;
    }

    if (!errorHandlersInitialized) {
      app.use((err, req, res, next) => {
        console.error('Error:', err);
        res.status(500).json({
          error: 'Internal server error',
          message: err.message,
          timestamp: new Date().toISOString()
        });
      });

      app.use((req, res) => {
        res.status(404).json({
          error: 'Not found',
          path: req.path,
          method: req.method
        });
      });

      errorHandlersInitialized = true;
    }

    // Start Express server
    const server = app.listen(PORT, () => {
      console.log(`
╔════════════════════════════════════════════════════════════╗
║  ✅ Supply Chain Logistics & Optimization System           ║
║     Backend Server Online & Connected to MongoDB           ║
╚════════════════════════════════════════════════════════════╝

📊 Server Configuration:
   🔗 Port: ${PORT}
   🌍 Environment: ${config.env}
   🗄️  Database: MongoDB (localhost:27017)
   📦 Database Name: logistics_optimization
   📈 Planning Horizon: ${config.system.planningHorizon} days
   ✅ Service Level Target: ${(config.system.defaultServiceLevel * 100).toFixed(0)}%

📊 Data Status:
   🏭 Warehouses: ${stats.totalWarehouses}
   👥 Customers: ${stats.totalCustomers}
   📦 Orders: ${stats.totalOrders}
   📍 Total Capacity: ${stats.warehouse.totalCapacity || 0} units
   
🔗 API Routes Available:
   • GET  /api/health              - Server health check
   • GET  /api/warehouses          - List all warehouses
   • GET  /api/customers           - List all customers
   • POST /api/orders              - Create new order
   • POST /api/forecast            - Generate demand forecast
   • POST /api/optimize            - Inventory optimization
   • POST /api/allocate            - Order allocation & routing
   • POST /api/disruption          - Disruption simulation
   • GET  /api/dashboard           - Full dashboard data
   • GET  /api/statistics          - System statistics

📡 Ready to handle logistics operations!
🎯 Access dashboard at: http://localhost:5173
      `);
    });

    // Graceful shutdown
    process.on('SIGTERM', async () => {
      console.log('\n🛑 Shutting down gracefully...');
      server.close(async () => {
        if (!config.useMockData) {
          await disconnectDB();
        }
        process.exit(0);
      });
    });

    process.on('SIGINT', async () => {
      console.log('\n🛑 Shutting down gracefully...');
      server.close(async () => {
        if (!config.useMockData) {
          await disconnectDB();
        }
        process.exit(0);
      });
    });

  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
}

// Start the server
startServer();

module.exports = app;
