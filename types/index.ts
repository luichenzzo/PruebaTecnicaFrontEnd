export type Role = "ADMIN" | "MANAGER" | "OPERATOR";

export interface User {
  id: string;
  username: string;
  fullName: string;
  email: string;
  role: Role;
  branchId: string | null;
}

export interface AuthResponse {
  token: string;
  tokenType: string;
  user: User;
}

export interface Product {
  id: string;
  sku: string;
  name: string;
  description: string;
  unitOfMeasureId: string | null;
  supplierId: string | null;
  defaultCost: number;
  createdById: string | null;
  updatedById: string | null;
}

export interface Inventory {
  id: string;
  productId: string;
  productSku: string;
  productName: string;
  branchId: string;
  quantity: number;
  reserved: number;
  defaultCost?: number; // Added based on product having defaultCost
  productDefaultCost?: number; // In case the DTO uses productDefaultCost
  createdById: string | null;
  updatedById: string | null;
}

export interface SaleItem {
  productId: string;
  productSku: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
}

export interface Sale {
  id: string;
  saleNumber: string;
  branchId: string;
  status: string;
  total: number;
  items: SaleItem[];
  createdById: string | null;
  updatedById: string | null;
}

export interface CreateSaleItemRequest {
  productId: string;
  quantity: number;
  unitPrice: number;
}

export interface CreateSaleRequest {
  saleNumber: string;
  branchId: string;
  items: CreateSaleItemRequest[];
}

export interface PurchaseOrderItem {
  productId: string;
  productSku: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
}

export interface PurchaseOrder {
  id: string;
  orderNumber: string;
  supplierId: string;
  branchId: string;
  status: string;
  total: number;
  items: PurchaseOrderItem[];
  createdById: string | null;
  updatedById: string | null;
}

export interface TransferItem {
  productId: string;
  productSku: string;
  productName: string;
  quantity: number;
}

export interface Transfer {
  id: string;
  transferNumber: string;
  fromBranchId: string;
  toBranchId: string;
  status: string;
  items: TransferItem[];
  createdById: string | null;
  updatedById: string | null;
}

export interface InventoryMovement {
  id: string;
  inventoryId: string;
  productId: string;
  productSku: string;
  branchId: string;
  movementCategory: "IN" | "OUT" | "TRANSFER" | "ADJUSTMENT";
  movementType: string;
  quantity: number;
  reference: string;
  notes: string;
  sourceType: string;
  sourceId: string | null;
  createdAt: string;
  createdById: string | null;
}

export interface ReportsOverview {
  totalProducts: number;
  totalBranches: number;
  totalSales: number;
  totalPurchaseOrders: number;
  totalTransfers: number;
  totalInventoryMovements: number;
}

export interface InventorySummary {
  productId: string;
  productSku: string;
  productName: string;
  totalQuantity: number;
  totalReserved: number;
}

export interface ApiError {
  timestamp: string;
  status: number;
  error: string;
  message: string;
  validationErrors: Record<string, string> | null;
}
