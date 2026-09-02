// Inventory Management Routes

const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');

module.exports = (dataManager) => {
  // List inventory
  router.get('/', async (req, res) => {
    try {
      const { page = 1, limit = 50, warehouseId, productId, search } = req.query;
      const result = await dataManager.getInventory({ page, limit, warehouseId, productId, search });
      res.json(result);
    } catch (error) {
      console.error('Error fetching inventory:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Get inventory item
  router.get('/:id', async (req, res) => {
    try {
      const item = await dataManager.getInventoryItem(req.params.id);
      if (!item) return res.status(404).json({ error: 'Inventory item not found' });
      res.json(item);
    } catch (error) {
      console.error('Error fetching inventory item:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Add stock
  router.post('/add', async (req, res) => {
    try {
      const { productId, warehouseId, quantity, minimumStockLevel, performedBy, reason, reference } = req.body;
      if (!productId || !warehouseId || !quantity) return res.status(400).json({ error: 'Missing required fields' });
      const inv = await dataManager.addStock({ productId, warehouseId, quantity, minimumStockLevel, performedBy, reason, reference });
      res.json({ success: true, inventory: inv });
    } catch (error) {
      console.error('Error adding stock:', error);
      res.status(400).json({ error: error.message });
    }
  });

  // Remove stock
  router.post('/remove', async (req, res) => {
    try {
      const { inventoryId, productId, warehouseId, quantity, performedBy, reason, reference } = req.body;
      if (!quantity || (!inventoryId && !(productId && warehouseId))) return res.status(400).json({ error: 'Missing required fields' });
      const inv = await dataManager.removeStock({ inventoryId, productId, warehouseId, quantity, performedBy, reason, reference });
      res.json({ success: true, inventory: inv });
    } catch (error) {
      console.error('Error removing stock:', error);
      res.status(400).json({ error: error.message });
    }
  });

  // Adjust stock
  router.post('/adjust', async (req, res) => {
    try {
      const { inventoryId, productId, warehouseId, newQuantity, performedBy, reason, reference } = req.body;
      if (newQuantity == null || (!inventoryId && !(productId && warehouseId))) return res.status(400).json({ error: 'Missing required fields' });
      const inv = await dataManager.adjustStock({ inventoryId, productId, warehouseId, newQuantity, performedBy, reason, reference });
      res.json({ success: true, inventory: inv });
    } catch (error) {
      console.error('Error adjusting stock:', error);
      res.status(400).json({ error: error.message });
    }
  });

  // Inventory history
  router.get('/:id/history', async (req, res) => {
    try {
      const { page = 1, limit = 50 } = req.query;
      const result = await dataManager.getInventoryHistory(req.params.id, { page, limit });
      res.json(result);
    } catch (error) {
      console.error('Error fetching inventory history:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Low stock
  router.get('/low-stock', async (req, res) => {
    try {
      const { threshold = 0 } = req.query;
      const items = await dataManager.getLowStock(Number(threshold));
      res.json({ total: items.length, items });
    } catch (error) {
      console.error('Error fetching low stock:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Out of stock
  router.get('/out-of-stock', async (req, res) => {
    try {
      const items = await dataManager.getOutOfStock();
      res.json({ total: items.length, items });
    } catch (error) {
      console.error('Error fetching out of stock:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Search convenience
  router.get('/search/:query', async (req, res) => {
    try {
      const q = req.params.query;
      const result = await dataManager.getInventory({ search: q });
      res.json(result);
    } catch (error) {
      console.error('Error searching inventory:', error);
      res.status(500).json({ error: error.message });
    }
  });

  return router;
};
