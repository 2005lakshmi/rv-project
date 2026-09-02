// Product Management Routes

const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');

module.exports = (dataManager) => {
  // Create product
  router.post('/', async (req, res) => {
    try {
      const {
        sku,
        name,
        description = '',
        category = '',
        price = 0,
        supplierId = null,
        minimumStockLevel = 0,
        unit = '',
        image = '',
        status = 'ACTIVE'
      } = req.body;

      if (!sku || !name) {
        return res.status(400).json({ error: 'Missing required fields: sku, name' });
      }

      // SKU uniqueness
      const existing = await dataManager.getProductBySku(sku);
      if (existing) {
        return res.status(409).json({ error: 'SKU already exists' });
      }

      const product = {
        id: 'PROD-' + uuidv4().substring(0, 8).toUpperCase(),
        sku,
        name,
        description,
        category,
        price: Number(price),
        supplierId,
        minimumStockLevel: Number(minimumStockLevel),
        unit,
        image,
        status,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      await dataManager.addProduct(product);

      res.status(201).json({ success: true, product });
    } catch (error) {
      console.error('Error creating product:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Get products list with filters, sorting and pagination
  router.get('/', async (req, res) => {
    try {
      const {
        page = 1,
        limit = 20,
        category,
        status,
        search,
        sortBy = 'createdAt',
        sortOrder = 'desc'
      } = req.query;

      const options = {
        page: Number(page),
        limit: Number(limit),
        category,
        status,
        search,
        sortBy,
        sortOrder
      };

      const result = await dataManager.getProducts(options);

      res.json(result);
    } catch (error) {
      console.error('Error fetching products:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Get single product
  router.get('/:id', async (req, res) => {
    try {
      const product = await dataManager.getProduct(req.params.id);
      if (!product) return res.status(404).json({ error: 'Product not found' });
      res.json(product);
    } catch (error) {
      console.error('Error fetching product:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Update product
  router.put('/:id', async (req, res) => {
    try {
      const update = { ...req.body };
      update.updatedAt = new Date();

      // If SKU is being changed, ensure uniqueness
      if (update.sku) {
        const existing = await dataManager.getProductBySku(update.sku);
        if (existing && existing.id !== req.params.id) {
          return res.status(409).json({ error: 'SKU already exists' });
        }
      }

      const result = await dataManager.updateProduct(req.params.id, update);
      if (!result || result.matchedCount === 0) {
        // For LocalDataManager the return shape might be different
        const maybe = await dataManager.getProduct(req.params.id);
        if (!maybe) return res.status(404).json({ error: 'Product not found' });
      }

      const updated = await dataManager.getProduct(req.params.id);
      res.json({ success: true, product: updated });
    } catch (error) {
      console.error('Error updating product:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Delete / Deactivate product (soft delete by default)
  router.delete('/:id', async (req, res) => {
    try {
      const hard = req.query.hard === 'true';
      const product = await dataManager.getProduct(req.params.id);
      if (!product) return res.status(404).json({ error: 'Product not found' });

      await dataManager.deleteProduct(req.params.id, !hard);

      res.json({ success: true, message: hard ? 'Product deleted' : 'Product deactivated' });
    } catch (error) {
      console.error('Error deleting product:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Search endpoint (convenience)
  router.get('/search/:query', async (req, res) => {
    try {
      const query = req.params.query;
      const products = await dataManager.searchProducts(query);
      res.json({ total: products.length, products });
    } catch (error) {
      console.error('Error searching products:', error);
      res.status(500).json({ error: error.message });
    }
  });

  return router;
};
