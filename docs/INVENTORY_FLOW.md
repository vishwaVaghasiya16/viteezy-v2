# Viteezy Inventory System Technical Documentation

## 1. Purpose and Scope

This document defines the end-to-end inventory architecture for Viteezy V2, including data model, movement lifecycle, validation rules, transaction boundaries, idempotency, audit trail strategy, and operational practices.

Scope includes:
- SKU-based, multi-location inventory
- Staff-driven manual stock operations
- Inventory movement ledger as source of truth
- Current stock state projection in inventory documents
- Reservation and sale lifecycle
- Concurrency and retry safety

Out of scope:
- External warehouse/manufacturer APIs
- Automated warehouse robotics
- Third-party inventory synchronization

## 2. Core Principles

1. Inventory movements are immutable ledger records.
2. Inventory table is a current-state projection (`stockQuantity`, `reservedQuantity`).
3. Every stock change must be represented by exactly one movement.
4. Business validation is explicit and movement-type specific.
5. Transaction + atomic guards prevent invalid states.
6. Idempotency keys make retries safe and deterministic.
7. Audit snapshots preserve before/after/delta state for reporting.

## 3. Domain Entities

### 3.1 SKU
Represents a specific sellable variant.

### 3.2 Location
Represents stock-holding or movement endpoints.

Location types:
- `MANUFACTURER`
- `WAREHOUSE`
- `FULFILLMENT_CENTER`
- `PACKAGING_PARTNER`
- `CUSTOMER`

### 3.3 Inventory
Current state for one `(skuId, locationId)` pair.

Fields:
- `stockQuantity`
- `reservedQuantity`
- virtual `availableQuantity = stockQuantity - reservedQuantity`
- `lowStockThreshold`

Invariant:
- `stockQuantity >= 0`
- `reservedQuantity >= 0`
- `reservedQuantity <= stockQuantity`

### 3.4 InventoryMovement
Immutable audit ledger entry.

Key fields:
- identity: `movementType`, `skuId`, `quantity`, `createdAt`
- routing: `fromLocationId`, `toLocationId`
- linkage: `orderId`, `subscriptionId`
- retry safety: `idempotencyKey` (unique)
- adjustment metadata: `reason`, `adjustmentDirection`, `note`
- actor: `performedBy`
- audit snapshots: `stockBefore`, `stockAfter`, `stockDelta`

## 4. Movement Types and Semantics

- `PURCHASE`: inbound stock from manufacturer to internal operational locations.
- `TRANSFER`: internal relocation between eligible operational locations.
- `RESERVATION`: reserves available stock for order/subscription.
- `RELEASE_RESERVATION`: frees previously reserved stock.
- `SALE`: ships/sells from reserved stock only.
- `RETURN`: customer return into warehouse.
- `ADJUSTMENT`: manual correction with explicit `adjustmentDirection`.

## 5. API Input Contract (Create Movement)

Required baseline:
- `movementType`
- `skuId`
- `quantity` (positive integer)
- `idempotencyKey`

Conditional requirements:
- `RESERVATION`/`SALE`: require `orderId` or `subscriptionId`
- `ADJUSTMENT`: require `fromLocationId`, `adjustmentReason`, `adjustmentDirection`
- `TRANSFER`: require both `fromLocationId` and `toLocationId` and they must differ

## 6. Validation Architecture

Validation happens in layers:

1. Request schema validation (`Joi`)
- field format, enums, required fields, per-type shape

2. Service business validation
- location type matrix
- quantity and linkage consistency
- reservation prerequisites for sale

3. Database guarded updates
- atomic query predicates prevent underflow/race invalid states

4. Schema-level safety nets
- immutable movement records
- adjustment direction/reason required

## 7. Location Validation Matrix

### 7.1 PURCHASE
Allowed:
- `MANUFACTURER -> WAREHOUSE`
- `MANUFACTURER -> FULFILLMENT_CENTER`
- `MANUFACTURER -> PACKAGING_PARTNER`

Rejected:
- Any non-manufacturer source
- Destination `CUSTOMER` or `MANUFACTURER`

### 7.2 TRANSFER
Allowed:
- Operational internal movements excluding manufacturer/customer endpoints

Rejected:
- `from = MANUFACTURER`
- `to = MANUFACTURER`
- `to = CUSTOMER`

### 7.3 RETURN
Allowed:
- `CUSTOMER -> WAREHOUSE`

### 7.4 SALE
Allowed:
- `FULFILLMENT_CENTER|PACKAGING_PARTNER -> CUSTOMER`

### 7.5 RESERVATION / RELEASE_RESERVATION / ADJUSTMENT
Validated against appropriate source location presence and state constraints.

## 8. Adjustment Design

Adjustment no longer infers polarity from location fields.

Use:
- `adjustmentDirection = INCREASE | DECREASE`
- `quantity` stays positive

Behavior:
- `INCREASE`: increments `stockQuantity`
- `DECREASE`: decrements only if `availableQuantity >= quantity`

Critical guard:
- `DECREASE` must never consume reserved stock.

Example prevented state:
- before: `stock=10`, `reserved=8`, `available=2`
- request: `DECREASE 5`
- result: rejected atomically (not enough available)

## 9. Reservation and Sale Guarantees

### 9.1 Reservation linkage
`RESERVATION` requires `orderId` or `subscriptionId`.

### 9.2 Sale linkage
`SALE` requires `orderId` or `subscriptionId` and matching reserved balance.

### 9.3 Prior reservation enforcement
For the same `(skuId, fromLocationId, order/subscription)`:
- Compute `reservedTotal - releasedTotal - soldTotal`
- Sale allowed only if remaining reserved balance >= requested quantity

### 9.4 Subscription Fulfillment Synchronization
If a movement is linked to a `subscriptionId`, the system guarantees cross-domain consistency:
- The referenced subscription must have an `ACTIVE` status.
- The requested SKU must align with a product actively configured within the subscription items.
- The movement is strictly restricted to the `SACHETS` product variant.
- If `quantity` is omitted by the caller, the system auto-resolves the exact volume using the subscription item's `capsuleCount`.

## 10. Execution Flow (Transaction)

For each create movement request:

1. Build context (sku/location/linkage/idempotency).
2. Validate movement policy + matrix.
3. Start Mongo session + transaction.
4. Idempotency read by `idempotencyKey`.
- If found: return existing result.
5. Apply atomic inventory mutations.
6. Insert immutable movement audit row.
7. Commit transaction.
8. Trigger low stock alert outside transaction.

## 11. Concurrency and Idempotency Strategy

### 11.1 Idempotency key
Client must generate a unique key per business action.
Recommended format:
- `inventory:{movementType}:{businessRef}:{skuId}:{location}:{nonce}`

### 11.2 DB uniqueness
Unique index on `inventory_movements.idempotencyKey` ensures exactly-once recording under concurrent retries.

### 11.3 Retry behavior
- First request commits movement.
- Concurrent duplicate gets duplicate-key or sees existing movement.
- Service returns original committed result.

### 11.4 Atomic guards
Examples:
- decrement available: `$expr: stockQuantity - reservedQuantity >= qty`
- decrement reserved: `reservedQuantity >= qty`
- sale decrement both: `stockQuantity >= qty AND reservedQuantity >= qty`

## 12. Audit Snapshot Model

Each movement stores:

- `stockBefore`
- `stockAfter`
- `stockDelta` with:
- `stockBefore`, `reservedBefore`, `availableBefore`
- `stockDelta`, `reservedDelta`
- `stockAfter`, `reservedAfter`, `availableAfter`

Benefits:
- fast audit/report reads
- no replay needed for common historical views
- explicit operational accountability

## 13. Indexing Strategy

### 13.1 inventory
- unique `{ skuId, locationId }`
- query `{ skuId, isDeleted }`
- query `{ locationId, isDeleted }`

### 13.2 inventory_movements
- unique `{ idempotencyKey }`
- `{ skuId, createdAt: -1 }`
- `{ fromLocationId, createdAt: -1 }`
- `{ toLocationId, createdAt: -1 }`
- `{ movementType, createdAt: -1 }`
- `{ orderId }`
- `{ subscriptionId }`
- `{ performedBy, createdAt: -1 }`

## 14. Operational Flows

### 14.1 Purchase receiving
- staff records purchase from manufacturer to internal location
- stock increases
- movement audit captured

### 14.2 Reservation
- staff reserves stock for order/subscription
- reserved increases; stock unchanged

### 14.3 Sale/Shipment
- requires reservation balance
- stock and reserved both decrease atomically

### 14.4 Release reservation
- reserved decreases (cancellation/partial unreserve)

### 14.5 Transfer
- source available stock decreases, destination stock increases in same transaction

### 14.6 Return
- stock added back to warehouse from customer endpoint

### 14.7 Manual adjustment
- explicit increase/decrease with reason and note
- decrease guarded by available stock

## 15. Error Handling Standards

Use deterministic business errors:
- 400 for invalid request/state
- 404 for missing SKU/location/inventory references
- 409 for duplicate reservation or reservation-balance conflict

Never partially commit movement and inventory changes; transaction boundary is mandatory.

## 16. Monitoring and Reporting

Recommended dashboards:
- available stock by location and SKU
- reserved-to-stock ratio alerts
- adjustment volume by reason and staff
- sale-without-reservation attempts (should be zero)
- idempotency duplicate hit rate

Recommended alerts:
- low stock threshold
- high adjustment frequency for same SKU/location
- repeated failed movement attempts
