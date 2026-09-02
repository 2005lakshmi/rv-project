// Configuration for the logistics system

require('dotenv').config();

const config = {
  // API Keys
  apis: {
    gemini: process.env.GEMINI_API_KEY || '',
    geminiModel: process.env.GEMINI_MODEL || 'gemini-1.5-flash',
    googleMaps: process.env.GOOGLE_MAPS_API_KEY || ''
  },

  // Server configuration
  port: process.env.PORT || 3000,
  env: process.env.NODE_ENV || 'development',
  useMockData: ['1', 'true', 'yes'].includes(String(process.env.USE_MOCK_DATA || '').toLowerCase()),

  // System parameters
  system: {
    defaultServiceLevel: 0.95,          // 95% on-time delivery target
    planningHorizon: 30,                // Days to forecast
    forecastMethod: 'movingAverage',    // 'movingAverage', 'linear', 'lstm'
    movingAverageWindow: 7,             // Days for moving average
  },

  // Logistics parameters
  logistics: {
    avgFuelCostPerKm: 0.5,              // $ per km
    laborCostPerHour: 25,               // $ per hour
    avgSpeedKmPerHour: 60,              // km/h
    co2PerKm: 0.12,                     // kg CO2 per km
    maxDeliveryDaysPerOrder: 5,         // Max days to deliver
    
    // Safety stock calculation
    safetyStockServiceLevel: 0.95,      // 95% service level
    leadTimeDays: 2,                    // Supplier lead time
  },

  // Inventory parameters
  inventory: {
    holdingCostPerUnitPerDay: 0.5,      // $ per unit per day
    orderingCostPerOrder: 100,          // $ fixed cost per order
    minStockWarningLevel: 0.2,          // 20% of capacity
  },

  // Disruption simulation
  disruption: {
    warehouseFailureRate: 0.01,         // 1% chance per simulation
    shipmentDelayRate: 0.05,            // 5% chance delay
    routeBlockageRate: 0.02,            // 2% chance blocked route
  },

  // Data source
  data: {
    warehousesFile: './data/warehouses.json',
    customersFile: './data/customers.json',
    ordersFile: './data/orders.json',
    ordersHistoryFile: './data/orders_history.json',
    demandHistoryFile: './data/demand_history.json',
  },
};

module.exports = config;
