import mongoose from "mongoose";
import {
  MovementType,
  MovementStatus,
  LocationType,
  InventoryAdjustmentReason,
  ProductVariant,
  AdjustmentDirection,
} from "@/models/enums";

// SECTION 1 — LOCATION DTOs

export interface CreateLocationDto {
  name: string;
  type: LocationType;
  address?: {
    street?: string;
    street2?: string;
    postalCode?: string;
    city?: string;
    state?: string;
    country?: string;
    countryCode?: string;
  };
  contactPerson?: {
    name?: string;
    phone?: string;
    phoneCountryCode?: string;
    email?: string;
    designation?: string;
  };
}

export interface UpdateLocationDto {
  name?: string;
  address?: {
    street?: string;
    street2?: string;
    postalCode?: string;
    city?: string;
    state?: string;
    country?: string;
    countryCode?: string;
  };
  contactPerson?: {
    name?: string;
    phone?: string;
    phoneCountryCode?: string;
    email?: string;
    designation?: string;
  };
  isActive?: boolean;
}

export interface LocationFilterDto {
  type?: LocationType;
  isActive?: boolean;
  search?: string;          // searches name, contactPerson
  page?: number;
  limit?: number;
}

// SECTION 2 — SKU DTOs

export interface CreateSkuDto {
  skuCode: string;

  productId: string;
  variantType: ProductVariant;
  displayName: string;
  unit: string;
  weightGrams?: number;
}

export interface UpdateSkuDto {
  displayName?: string;
  unit?: string;
  weightGrams?: number;
  isActive?: boolean;
}

export interface SkuFilterDto {
  variantType?: ProductVariant;
  isActive?: boolean;
  search?: string;          // searches skuCode, displayName
  page?: number;
  limit?: number;
}

// SECTION 3 — MOVEMENT DTOs

/**
 * CreateMovementDto — used by staff to record any stock change.
 *
 * Field requirements per movementType:
 *
 * Purchase            → skuId, toLocationId, quantity
 * Transfer            → skuId, fromLocationId, toLocationId, quantity
 * Sale                → skuId, fromLocationId, quantity, orderId
 * Return              → skuId, toLocationId, quantity
 * Reservation         → skuId, fromLocationId, quantity, orderId
 * Release Reservation → skuId, fromLocationId, quantity, orderId
 * Adjustment          → skuId, fromLocationId OR toLocationId, quantity, adjustmentReason
 */
export interface CreateMovementDto {
  movementType: MovementType;
  skuId: string;
  fromLocationId?: string;
  toLocationId?: string;
  quantity: number;
  // Linkage
  orderId?: string;
  subscriptionId?: string;
  customerId?: string;                  // user ID or shipping address ID
  referenceCode?: string;
  // Adjustment specific
  adjustmentDirection?: AdjustmentDirection;
  adjustmentReason?: InventoryAdjustmentReason;
  adjustmentNote?: string;              // free-text additional context
  // Injected by auth middleware — never accepted from request body
  performedBy?: string;
}

export interface MovementFilterDto {
  skuId?: string;
  fromLocationId?: string;
  toLocationId?: string;
  locationId?: string;                  // matches either from or to location
  movementType?: MovementType;
  status?: MovementStatus;
  orderId?: string;
  subscriptionId?: string;
  customerId?: string;
  performedBy?: string;
  dateFrom?: Date | string;
  dateTo?: Date | string;
  page?: number;
  limit?: number;
}

// SECTION 4 — INVENTORY DTOs

export interface UpdateThresholdDto {
  lowStockThreshold: number;
}

export interface InventoryFilterDto {
  locationId?: string;
  skuId?: string;
  variantType?: ProductVariant;
  isLowStock?: boolean;
  isOutOfStock?: boolean;
  page?: number;
  limit?: number;
}

// SECTION 5 — INTERNAL SERVICE TYPES

/**
 * ProcessedMovementContext — built inside movement.service.ts after
 * SKU and Location documents are fetched and validated, before the
 * MongoDB session/transaction is opened.
 */
export interface ProcessedMovementContext {
  movementType: MovementType;
  sku: {
    _id: mongoose.Types.ObjectId;
    skuCode: string;
    displayName: string;
    productId: mongoose.Types.ObjectId;
    variantType: ProductVariant;
  };
  fromLocation?: {
    _id: mongoose.Types.ObjectId;
    name: string;
    type: LocationType;
  };
  toLocation?: {
    _id: mongoose.Types.ObjectId;
    name: string;
    type: LocationType;
  };
  quantity: number;
  orderId?: mongoose.Types.ObjectId;
  subscriptionId?: mongoose.Types.ObjectId;
  customerId?: mongoose.Types.ObjectId;
  referenceCode?: string;
  adjustmentDirection?: AdjustmentDirection;
  adjustmentReason?: InventoryAdjustmentReason;
  adjustmentNote?: string;
  performedBy: mongoose.Types.ObjectId;
}

/**
 * StockSnapshot — point-in-time stock state captured after a movement
 * completes. Stored in InventoryMovement.stockAfter and returned to caller.
 */
export interface StockSnapshot {
  locationId: mongoose.Types.ObjectId;
  locationName: string;
  stockQuantity: number;
  reservedQuantity: number;
  availableQuantity: number;            // computed: stock - reserved
}

/**
 * MovementResult — returned by movement.service.ts after a successful
 * transaction. Includes resulting stock state so caller avoids a second query.
 */
export interface MovementResult {
  movementId: mongoose.Types.ObjectId;
  movementType: MovementType;
  status: MovementStatus;
  skuId: mongoose.Types.ObjectId;
  quantity: number;
  stockBefore: {
    fromLocation?: StockSnapshot;
    toLocation?: StockSnapshot;
  };
  stockDelta: {
    fromLocation?: StockSnapshot;
    toLocation?: StockSnapshot;
  };
  stockAfter: {
    fromLocation?: StockSnapshot;
    toLocation?: StockSnapshot;
  };
}

// SECTION 6 — DASHBOARD & RESPONSE TYPES

/**
 * LocationStockView — one location's stock state for a single SKU.
 */
export interface LocationStockView {
  locationId: mongoose.Types.ObjectId;
  locationName: string;
  locationType: LocationType;
  stockQuantity: number;
  reservedQuantity: number;
  availableQuantity: number;
  lowStockThreshold: number;
  isLowStock: boolean;
  isOutOfStock: boolean;
}

/**
 * SkuStockView — full stock breakdown for one SKU across all locations.
 * Returned by GET /api/inventory/sku/:skuId
 */
export interface SkuStockView {
  skuId: mongoose.Types.ObjectId;
  skuCode: string;
  displayName: string;
  variantType: ProductVariant;
  unit: string;
  totalStock: number;
  totalReserved: number;
  totalAvailable: number;
  isLowStock: boolean;                  // true if any location is low
  isOutOfStock: boolean;                // true if totalAvailable <= 0
  locations: LocationStockView[];
}

/**
 * InventoryDashboardResponse — all SKUs across all locations.
 * Returned by GET /api/inventory/dashboard
 */
export interface InventoryDashboardResponse {
  summary: {
    totalSkus: number;
    lowStockCount: number;
    outOfStockCount: number;
  };
  skus: SkuStockView[];
  generatedAt: Date;
}

/**
 * LocationStockSummary — all SKUs at one location.
 * Returned by GET /api/inventory/location/:locationId
 */
export interface LocationStockSummary {
  locationId: mongoose.Types.ObjectId;
  locationName: string;
  locationType: LocationType;
  totalSkus: number;
  items: {
    skuId: mongoose.Types.ObjectId;
    skuCode: string;
    displayName: string;
    variantType: ProductVariant;
    stockQuantity: number;
    reservedQuantity: number;
    availableQuantity: number;
    lowStockThreshold: number;
    isLowStock: boolean;
    isOutOfStock: boolean;
  }[];
}

/**
 * LowStockAlert — used by alert.service.ts and returned by
 * GET /api/inventory/low-stock
 */
export interface LowStockAlert {
  skuId: mongoose.Types.ObjectId;
  skuCode: string;
  displayName: string;
  variantType: ProductVariant;
  locationId: mongoose.Types.ObjectId;
  locationName: string;
  locationType: LocationType;
  availableQuantity: number;
  lowStockThreshold: number;
  deficit: number;                      // lowStockThreshold - availableQuantity
}

// SECTION 7 — PAGINATION WRAPPER

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    pages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}

// SECTION 8 — BUSINESS RULES MATRIX

export interface AllowedRoute {
  allowedSources: LocationType[];
  allowedDestinations: LocationType[];
  requiresSameLocation?: boolean;
}



// SECTION 9 — TYPE GUARD HELPERS

/**
 * Called in validators and movement.service.ts to avoid duplicating
 * movementType switch logic across layers.
 */

export function requiresFromLocation(type: MovementType): boolean {
  return [
    MovementType.PURCHASE,
    MovementType.TRANSFER,
    MovementType.SALE,
    MovementType.RESERVATION,
    MovementType.RELEASE_RESERVATION,
    MovementType.ADJUSTMENT,
  ].includes(type);
}

export function requiresToLocation(type: MovementType): boolean {
  return [
    MovementType.PURCHASE,
    MovementType.TRANSFER,
    MovementType.RETURN,
  ].includes(type);
}

export function requiresOrderId(type: MovementType): boolean {
  return [
    MovementType.SALE,
    MovementType.RESERVATION,
    MovementType.RELEASE_RESERVATION,
  ].includes(type);
}

export function requiresAdjustmentReason(type: MovementType): boolean {
  return type === MovementType.ADJUSTMENT;
}

/**
 * Used by alert.service.ts to decide whether to run a low-stock check
 * after a movement completes.
 */
export function isStockReducingMovement(type: MovementType): boolean {
  return [
    MovementType.TRANSFER,
    MovementType.SALE,
    MovementType.RESERVATION,
  ].includes(type);
}

// SECTION 10 — STOCK COMPUTATION HELPERS

/**
 * Single source of truth for all stock status computations.
 * Used by inventory.service.ts and the dashboard aggregation pipeline.
 */

export function computeAvailableQuantity(
  stockQuantity: number,
  reservedQuantity: number
): number {
  return Math.max(0, stockQuantity - reservedQuantity);
}

export function computeIsLowStock(
  availableQuantity: number,
  lowStockThreshold: number
): boolean {
  return availableQuantity > 0 && availableQuantity <= lowStockThreshold;
}

export function computeIsOutOfStock(availableQuantity: number): boolean {
  return availableQuantity <= 0;
}