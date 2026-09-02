// Warehouse Management Routes

const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');

module.exports = (dataManager) => {
  // Add warehouse
  router.post('/', async (req, res) => {
    try {
      const { name, code, address = '', city = '', state = '', country = '', postalCode = '', capacity = 0, managerId = null, status = 'ACTIVE' } = req.body;
      if (!name || !code) return res.status(400).json({ error: 'Missing required fields: name, code' });

      // ensure unique code
      const existing = (await dataManager.getWarehouses({ search: code })).warehouses.find(w => w.code === code);
      if (existing) return res.status(409).json({ error: 'Warehouse code already exists' });

      const warehouse = {
        id: 'WH-' + uuidv4().substring(0, 8).toUpperCase(),
        name,
        code,
        address,
        city,
        state,
        country,
        postalCode,
        capacity: Number(capacity),
        managerId,
        status,
        currentStock: {},
        createdAt: new Date(),
        updatedAt: new Date()
      };

      await dataManager.addWarehouse(warehouse);
      res.status(201).json({ success: true, warehouse });
    } catch (error) {
      console.error('Error creating warehouse:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // List warehouses
  router.get('/', async (req, res) => {
    try {
      const { page = 1, limit = 20, status, search, sortBy = 'createdAt', sortOrder = 'desc' } = req.query;
      const result = await dataManager.getWarehouses({ page, limit, status, search, sortBy, sortOrder });
      res.json(result);
    } catch (error) {
      console.error('Error fetching warehouses:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Get warehouse
  router.get('/:id', async (req, res) => {
    try {
      const warehouse = await dataManager.getWarehouse(req.params.id);
      if (!warehouse) return res.status(404).json({ error: 'Warehouse not found' });
      res.json(warehouse);
    } catch (error) {
      console.error('Error fetching warehouse:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Update warehouse
  router.put('/:id', async (req, res) => {
    try {
      const update = { ...req.body };
      update.updatedAt = new Date();

      // If code change, ensure uniqueness
      if (update.code) {
        const existing = (await dataManager.getWarehouses({ search: update.code })).warehouses.find(w => w.code === update.code);
        if (existing && existing.id !== req.params.id) return res.status(409).json({ error: 'Warehouse code already exists' });
      }

      await dataManager.updateWarehouse(req.params.id, update);
      const updated = await dataManager.getWarehouse(req.params.id);
      if (!updated) return res.status(404).json({ error: 'Warehouse not found' });
      res.json({ success: true, warehouse: updated });
    } catch (error) {
      console.error('Error updating warehouse:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Delete / deactivate
  router.delete('/:id', async (req, res) => {
    try {
      const hard = req.query.hard === 'true';
      const warehouse = await dataManager.getWarehouse(req.params.id);
      if (!warehouse) return res.status(404).json({ error: 'Warehouse not found' });
      await dataManager.deleteWarehouse(req.params.id, !hard);
      res.json({ success: true, message: hard ? 'Warehouse deleted' : 'Warehouse deactivated' });
    } catch (error) {
      console.error('Error deleting warehouse:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Assign manager
  router.post('/:id/assign-manager', async (req, res) => {
    try {
      const { managerId } = req.body;
      if (!managerId) return res.status(400).json({ error: 'Missing managerId' });
      await dataManager.updateWarehouse(req.params.id, { managerId });
      const updated = await dataManager.getWarehouse(req.params.id);
      res.json({ success: true, warehouse: updated });
    } catch (error) {
      console.error('Error assigning manager:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Warehouse inventory
  router.get('/:id/inventory', async (req, res) => {
    try {
      const inventory = await dataManager.getWarehouseInventory(req.params.id);
      if (inventory === null) return res.status(404).json({ error: 'Warehouse not found' });
      res.json({ warehouseId: req.params.id, inventory });
    } catch (error) {
      console.error('Error fetching inventory:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Search convenience
  router.get('/search/:query', async (req, res) => {
    try {
      const q = req.params.query;
      const results = await dataManager.getWarehouses({ search: q });
      res.json(results);
    } catch (error) {
      console.error('Error searching warehouses:', error);
      res.status(500).json({ error: error.message });
    }
  });

  return router;
};
