const express = require('express');
const router = express.Router();
const { buildRoutePlan } = require('../modules/disruptionInsights');
const { getDriverById, getDriverByWarehouse } = require('../constants/drivers');

function buildGoogleMapsUrl(origin, destination) {
  return `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(
    `${origin.lat},${origin.lon}`
  )}&destination=${encodeURIComponent(`${destination.lat},${destination.lon}`)}&travelmode=driving`;
}

function buildEmbedMapUrl(destination) {
  return `https://www.google.com/maps?q=${encodeURIComponent(
    `${destination.lat},${destination.lon}`
  )}&z=12&output=embed`;
}

module.exports = (dataManager, geminiAI) => {
  router.get('/orders/:driverId', async (req, res) => {
    try {
      const driverId = req.params.driverId;
      const driver = getDriverById(driverId);

      if (!driver) {
        return res.status(404).json({ error: 'Driver not found' });
      }

      const orders = await dataManager.getOrders();
      const filtered = orders.filter((order) => {
        if (order.driverAssignment?.driverId) {
          return order.driverAssignment.driverId === driverId;
        }

        return order.assignedWarehouse === driver.warehouseId;
      });

      res.json({
        driverId,
        warehouseId: driver.warehouseId,
        total: filtered.length,
        orders: filtered
      });
    } catch (error) {
      console.error('Driver orders error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  router.post('/dispatch', async (req, res) => {
    try {
      const { orderId, driverId, warehouseId } = req.body;
      const [order, warehouses, customers] = await Promise.all([
        dataManager.getOrder(orderId),
        dataManager.getWarehouses(),
        dataManager.getCustomers()
      ]);

      if (!order) {
        return res.status(404).json({ error: 'Order not found' });
      }

      const warehouse =
        warehouses.find((item) => item.id === order.assignedWarehouse) ||
        warehouses.find((item) => item.id === warehouseId);
      const customer = customers.find((item) => item.id === order.customerId);
      const destinationLocation = order.customerLocation || customer?.location;

      if (!warehouse || !customer || !destinationLocation) {
        return res.status(400).json({ error: 'Warehouse or customer location is missing' });
      }

      const assignedDriver = getDriverById(driverId) || getDriverByWarehouse(warehouse.id);

      const routePlan = buildRoutePlan(
        warehouse,
        {
          ...customer,
          location: destinationLocation
        },
        'normal'
      );
      const recommendedRoute = routePlan.recommendedRoute;

      let aiGuidance = {
        summary: 'Use the shortest route first and keep the traffic-aware option ready.',
        recommendedRouteReason: 'Heuristic route guidance',
        watchouts: ['Traffic congestion', 'Weather disruption']
      };

      if (typeof geminiAI?.recommendRoute === 'function') {
        aiGuidance = await geminiAI.recommendRoute({
          order,
          warehouse,
          customer,
          recommendedRoute,
          alternatives: routePlan.alternativeRoutes
        });
      }

      const googleMapsUrl = buildGoogleMapsUrl(warehouse.location, destinationLocation);
      const embedMapUrl = buildEmbedMapUrl(destinationLocation);

      if (order.status === 'assigned') {
        const currentStock = warehouse.currentStock?.[order.productId] || 0;
        const nextStock = Math.max(0, currentStock - order.quantity);
        await dataManager.updateWarehouseStock(warehouse.id, order.productId, nextStock);
      }

      await dataManager.updateOrderStatus(order.id, 'out_for_delivery', {
        assignedWarehouse: warehouse.id,
        route: {
          ...(order.route || {}),
          ...(recommendedRoute || {}),
          origin: warehouse.location,
          destination: destinationLocation,
          googleMapsUrl,
          embedMapUrl
        },
        driverAssignment: {
          driverId: assignedDriver?.id || driverId,
          driverName: assignedDriver?.name || null,
          warehouseId: warehouse.id,
          dispatchedAt: new Date().toISOString()
        }
      });

      res.json({
        success: true,
        orderId: order.id,
        driverId: assignedDriver?.id || driverId,
        origin: warehouse.location,
        destination: destinationLocation,
        customerLocationName: order.customerLocationName || `${customer.name}, ${customer.region || 'Customer region'}`,
        routeRecommendation: recommendedRoute,
        alternativeRoutes: routePlan.alternativeRoutes,
        aiGuidance,
        googleMapsUrl,
        embedMapUrl
      });
    } catch (error) {
      console.error('Driver dispatch error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  router.post('/deliver', async (req, res) => {
    try {
      const { orderId, driverId } = req.body;
      const order = await dataManager.getOrder(orderId);

      if (!order) {
        return res.status(404).json({ error: 'Order not found' });
      }

      await dataManager.updateOrderStatus(order.id, 'delivered', {
        deliveredAt: new Date().toISOString(),
        driverAssignment: {
          ...(order.driverAssignment || {}),
          driverId: driverId || order.driverAssignment?.driverId,
          deliveredAt: new Date().toISOString()
        }
      });

      res.json({
        success: true,
        orderId: order.id,
        status: 'delivered',
        deliveredAt: new Date().toISOString()
      });
    } catch (error) {
      console.error('Driver delivery completion error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  return router;
};
