// Supplier Management Routes

const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');

module.exports = (dataManager) => {
  // Create supplier
  router.post('/', async (req, res) => {
    try {
      const {
        name,
        companyName = '',
        email = '',
        phone = '',
        address = '',
        city = '',
        state = '',
        country = '',
        postalCode = '',
        rating = null,
        status = 'ACTIVE'
      } = req.body;

      if (!name) return res.status(400).json({ error: 'Missing required field: name' });

      const supplier = {
        id: 'SUP-' + uuidv4().substring(0, 8).toUpperCase(),
        name,
        companyName,
        email,
        phone,
        address,
        city,
        state,
        country,
        postalCode,
        rating,
        status,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      await dataManager.addSupplier(supplier);

      res.status(201).json({ success: true, supplier });
    } catch (error) {
      console.error('Error creating supplier:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // List suppliers with filters/pagination
  router.get('/', async (req, res) => {
    try {
      const { page = 1, limit = 20, status, search, sortBy = 'createdAt', sortOrder = 'desc' } = req.query;
      const result = await dataManager.getSuppliers({ page, limit, status, search, sortBy, sortOrder });
      res.json(result);
    } catch (error) {
      console.error('Error fetching suppliers:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Get supplier
  router.get('/:id', async (req, res) => {
    try {
      const supplier = await dataManager.getSupplier(req.params.id);
      if (!supplier) return res.status(404).json({ error: 'Supplier not found' });
      res.json(supplier);
    } catch (error) {
      console.error('Error fetching supplier:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Update supplier
  router.put('/:id', async (req, res) => {
    try {
      const update = { ...req.body };
      update.updatedAt = new Date();
      await dataManager.updateSupplier(req.params.id, update);
      const updated = await dataManager.getSupplier(req.params.id);
      if (!updated) return res.status(404).json({ error: 'Supplier not found' });
      res.json({ success: true, supplier: updated });
    } catch (error) {
      console.error('Error updating supplier:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Delete / deactivate
  router.delete('/:id', async (req, res) => {
    try {
      const hard = req.query.hard === 'true';
      const supplier = await dataManager.getSupplier(req.params.id);
      if (!supplier) return res.status(404).json({ error: 'Supplier not found' });
      await dataManager.deleteSupplier(req.params.id, !hard);
      res.json({ success: true, message: hard ? 'Supplier deleted' : 'Supplier deactivated' });
    } catch (error) {
      console.error('Error deleting supplier:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Search convenience
  router.get('/search/:query', async (req, res) => {
    try {
      const q = req.params.query;
      const results = await dataManager.searchSuppliers(q);
      res.json({ total: results.length, suppliers: results });
    } catch (error) {
      console.error('Error searching suppliers:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Get products for a supplier
  router.get('/:id/products', async (req, res) => {
    try {
      const { page = 1, limit = 20, status, search, sortBy = 'createdAt', sortOrder = 'desc' } = req.query;
      const supplier = await dataManager.getSupplier(req.params.id);
      if (!supplier) return res.status(404).json({ error: 'Supplier not found' });

      const products = await dataManager.getProductsBySupplier(req.params.id, { page, limit, status, search, sortBy, sortOrder });
      res.json(products);
    } catch (error) {
      console.error('Error fetching supplier products:', error);
      res.status(500).json({ error: error.message });
    }
  });

  return router;
};
