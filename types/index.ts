export type Role = "ADMIN" | "MANAGER" | "OPERATOR";

export interface User {
  id: string;
  username: string;
  fullName: string;
  email: string;
  role: Role;
  branchId: string | null;
}

export interface Branch {
  id: string;
  name: string;
  code: string;
  address: string;
  phone: string;
  isActive: boolean;
}

export interface Supplier {
  id: string;
  name: string;
  contactName?: string;
  email?: string;
  phone?: string;
  address?: string;
  isActive?: boolean;
}

export interface RegisterRequest {
  username: string;
  fullName: string;
  email: string;
  password?: string;
  role: Role;
  branchId?: string;
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
  branchCode: string;
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
  branchCode: string;
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

export interface CreatePurchaseOrderItemRequest {
  productId: string;
  quantity: number;
  unitPrice: number;
}

export interface CreatePurchaseOrderRequest {
  orderNumber: string;
  supplierId: string;
  branchId: string;
  items: CreatePurchaseOrderItemRequest[];
}

export interface PurchaseOrder {
  id: string;
  orderNumber: string;
  supplierId: string;
  branchId: string;
  branchCode: string;
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

export interface CreateTransferItemRequest {
  productId: string;
  quantity: number;
  unitPrice?: number; // In case the backend uses the same OrderItemRequest
}

export interface CreateTransferRequest {
  transferNumber: string;
  fromBranchId: string;
  toBranchId: string;
  items: CreateTransferItemRequest[];
}

export interface Transfer {
  id: string;
  transferNumber: string;
  fromBranchId: string;
  toBranchId: string;
  fromBranchCode: string;
  toBranchCode: string;
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
  branchCode: string;
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
