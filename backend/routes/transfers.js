// Stock Transfer Routes

const express = require('express');
const router = express.Router();

module.exports = (dataManager) => {
  // Create and execute transfer
  router.post('/', async (req, res) => {
    try {
      const { productId, sourceWarehouseId, destinationWarehouseId, quantity, createdBy, reference } = req.body;
      if (!productId || !sourceWarehouseId || !destinationWarehouseId || !quantity) return res.status(400).json({ error: 'Missing required fields' });

      const transfer = await dataManager.createTransfer({ productId, sourceWarehouseId, destinationWarehouseId, quantity, createdBy, reference });
      res.status(201).json({ success: true, transfer });
    } catch (error) {
      console.error('Error creating transfer:', error);
      res.status(400).json({ error: error.message });
    }
  });

  // List transfers
  router.get('/', async (req, res) => {
    try {
      const transfers = await dataManager.getTransfers();
      res.json({ total: transfers.length, transfers });
    } catch (error) {
      console.error('Error fetching transfers:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Get transfer
  router.get('/:id', async (req, res) => {
    try {
      const t = await dataManager.getTransfer(req.params.id);
      if (!t) return res.status(404).json({ error: 'Transfer not found' });
      res.json(t);
    } catch (error) {
      console.error('Error fetching transfer:', error);
      res.status(500).json({ error: error.message });
    }
  });

  return router;
};
