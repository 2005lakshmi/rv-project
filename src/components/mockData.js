// Minimal mock data used as a frontend fallback when API returns empty
export const mockProducts = [
  { id: 'PROD-AAA1', sku: 'SKU-1001', name: 'Widget A', category: 'Widgets', price: 12.5, status: 'ACTIVE' },
  { id: 'PROD-BBB2', sku: 'SKU-1002', name: 'Widget B', category: 'Widgets', price: 9.99, status: 'ACTIVE' },
  { id: 'PROD-CCC3', sku: 'SKU-2001', name: 'Gadget C', category: 'Gadgets', price: 25.0, status: 'ACTIVE' }
];

export const mockSuppliers = [
  { id: 'SUP-1', name: 'Alice Smith', companyName: 'Acme Supplies', email: 'alice@acme.test', phone: '+1-555-0100' },
  { id: 'SUP-2', name: 'Bob Jones', companyName: 'Global Parts', email: 'bob@global.test', phone: '+1-555-0101' }
];

export const mockInventory = [
  { id: 'INV-1', productId: 'PROD-AAA1', productName: 'Widget A', warehouseId: 'WH-1', quantity: 120, reservedQuantity: 10 },
  { id: 'INV-2', productId: 'PROD-BBB2', productName: 'Widget B', warehouseId: 'WH-2', quantity: 45, reservedQuantity: 5 },
  { id: 'INV-3', productId: 'PROD-CCC3', productName: 'Gadget C', warehouseId: 'WH-1', quantity: 200, reservedQuantity: 0 }
];

export default { mockProducts, mockSuppliers, mockInventory };
