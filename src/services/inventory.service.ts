import mongoose, { PipelineStage } from "mongoose";
import { Inventory } from "@/models/inventory";
import { Skus } from "@/models/inventory";
import { Locations } from "@/models/inventory";
import { InventoryMovements } from "@/models/inventory";
import {
  InventoryFilterDto,
  MovementFilterDto,
  UpdateThresholdDto,
  InventoryDashboardResponse,
  SkuStockView,
  LocationStockView,
  LocationStockSummary,
  LowStockAlert,
  PaginatedResponse,
  computeAvailableQuantity,
  computeIsLowStock,
  computeIsOutOfStock,
} from "../types/inventory.types";
import { ProductVariant } from "@/models/enums";


// INVENTORY SERVICE
//
// Read-only layer. Never writes stock directly.
// All mutations go through movement.service.ts.
//
// Responsibilities:
//   - Dashboard aggregation (all SKUs × all locations)
//   - Stock breakdown per SKU
//   - Stock breakdown per Location
//   - Low stock list
//   - Movement history with filters + pagination
//   - Threshold updates (the only write allowed here)

class InventoryService {
  // DASHBOARD

  /**
   * getDashboard()
   * Returns the full inventory picture — every SKU across every location.
   * Uses a single aggregation pipeline to minimise round trips.
   */
  async getDashboard(): Promise<InventoryDashboardResponse> {
    const pipeline : PipelineStage[] = [
      { $match: { isDeleted: false } },

      //  Join SKU 
      {
        $lookup: {
          from: "inventory_skus",
          localField: "skuId",
          foreignField: "_id",
          as: "sku",
        },
      },
      {
        $unwind: {
          path: "$sku",
          preserveNullAndEmptyArrays: false,
        },
      },
      {
        $match: {
          "sku.isDeleted": false,
          "sku.isActive": true,
        },
      },

      //  Join Location ─
      {
        $lookup: {
          from: "inventory_locations",
          localField: "locationId",
          foreignField: "_id",
          as: "location",
        },
      },
      {
        $unwind: {
          path: "$location",
          preserveNullAndEmptyArrays: false,
        },
      },
      {
        $match: {
          "location.isDeleted": false,
          "location.isActive": true,
        },
      },

      //  Compute per-record fields ─
      {
        $addFields: {
          availableQuantity: {
            $max: [{ $subtract: ["$stockQuantity", "$reservedQuantity"] }, 0],
          },
        },
      },
      {
        $addFields: {
          isLowStock: {
            $and: [
              { $gt: ["$availableQuantity", 0] },
              { $lte: ["$availableQuantity", "$lowStockThreshold"] },
            ],
          },
          isOutOfStock: { $lte: ["$availableQuantity", 0] },
        },
      },

      //  Group by SKU 
      {
        $group: {
          _id: "$skuId",
          skuCode: { $first: "$sku.skuCode" },
          displayName: { $first: "$sku.displayName" },
          variantType: { $first: "$sku.variantType" },
          unit: { $first: "$sku.unit" },
          totalStock: { $sum: "$stockQuantity" },
          totalReserved: { $sum: "$reservedQuantity" },
          totalAvailable: { $sum: "$availableQuantity" },
          anyLowStock: { $max: { $cond: ["$isLowStock", 1, 0] } },
          anyOutOfStock: { $max: { $cond: ["$isOutOfStock", 1, 0] } },
          locations: {
            $push: {
              locationId: "$location._id",
              locationName: "$location.name",
              locationType: "$location.type",
              stockQuantity: "$stockQuantity",
              reservedQuantity: "$reservedQuantity",
              availableQuantity: "$availableQuantity",
              lowStockThreshold: "$lowStockThreshold",
              isLowStock: "$isLowStock",
              isOutOfStock: "$isOutOfStock",
            },
          },
        },
      },

      //  Shape final SKU document 
      {
        $project: {
          _id: 0,
          skuId: "$_id",
          skuCode: 1,
          displayName: 1,
          variantType: 1,
          unit: 1,
          totalStock: 1,
          totalReserved: 1,
          totalAvailable: 1,
          isLowStock: { $eq: ["$anyLowStock", 1] },
          isOutOfStock: { $eq: ["$anyOutOfStock", 1] },
          locations: 1,
        },
      },

      { $sort: { skuCode: 1 } },
    ];

    const skus = (await Inventory.aggregate(pipeline)) as SkuStockView[];

    //  Summary counters 
    const lowStockCount = skus.filter((s) => s.isLowStock).length;
    const outOfStockCount = skus.filter((s) => s.isOutOfStock).length;

    return {
      summary: {
        totalSkus: skus.length,
        lowStockCount,
        outOfStockCount,
      },
      skus,
      generatedAt: new Date(),
    };
  }

  // STOCK BY SKU

  /**
   * getStockBySku()
   *
   * Returns full stock breakdown for one SKU across all its locations.
   * Returned by GET /api/inventory/sku/:skuId
   */
  async getStockBySku(skuId: string): Promise<SkuStockView> {
    const skuObjectId = new mongoose.Types.ObjectId(skuId);

    // Validate SKU exists
    const sku = await Skus.findOne({
      _id: skuObjectId,
      isActive: true,
      isDeleted: false,
    }).lean();

    if (!sku) throw new Error(`SKU not found: ${skuId}`);

    // Fetch all inventory records for this SKU with location details
    const records = await Inventory.aggregate([
      {
        $match: {
          skuId: skuObjectId,
          isDeleted: false,
        },
      },
      {
        $lookup: {
          from: "inventory_locations",
          localField: "locationId",
          foreignField: "_id",
          as: "location",
        },
      },
      {
        $unwind: {
          path: "$location",
          preserveNullAndEmptyArrays: false,
        },
      },
      {
        $match: {
          "location.isDeleted": false,
          "location.isActive": true,
        },
      },
      {
        $addFields: {
          availableQuantity: {
            $max: [{ $subtract: ["$stockQuantity", "$reservedQuantity"] }, 0],
          },
        },
      },
      {
        $project: {
          locationId: "$location._id",
          locationName: "$location.name",
          locationType: "$location.type",
          stockQuantity: 1,
          reservedQuantity: 1,
          availableQuantity: 1,
          lowStockThreshold: 1,
          isLowStock: {
            $and: [
              { $gt: ["$availableQuantity", 0] },
              { $lte: ["$availableQuantity", "$lowStockThreshold"] },
            ],
          },
          isOutOfStock: { $lte: ["$availableQuantity", 0] },
        },
      },
    ]);

    const locations = records as LocationStockView[];

    const totalStock = locations.reduce((sum, l) => sum + l.stockQuantity, 0);
    const totalReserved = locations.reduce((sum, l) => sum + l.reservedQuantity, 0);
    const totalAvailable = locations.reduce((sum, l) => sum + l.availableQuantity, 0);

    return {
      skuId: sku._id as mongoose.Types.ObjectId,
      skuCode: sku.skuCode,
      displayName: sku.displayName,
      variantType: sku.variantType,
      unit: sku.unit,
      totalStock,
      totalReserved,
      totalAvailable,
      isLowStock: locations.some((l) => l.isLowStock),
      isOutOfStock: totalAvailable <= 0,
      locations,
    };
  }

  // STOCK BY LOCATION

  /**
   * getStockByLocation()
   *
   * Returns all SKUs and their stock at a single location.
   * Returned by GET /api/inventory/location/:locationId
   */
  async getStockByLocation(locationId: string): Promise<LocationStockSummary> {
    const locationObjectId = new mongoose.Types.ObjectId(locationId);

    // Validate location exists
    const location = await Locations.findOne({
      _id: locationObjectId,
      isActive: true,
      isDeleted: false,
    }).lean();

    if (!location) throw new Error(`Location not found: ${locationId}`);

    const records = await Inventory.aggregate([
      {
        $match: {
          locationId: locationObjectId,
          isDeleted: false,
        },
      },
      {
        $lookup: {
          from: "inventory_skus",
          localField: "skuId",
          foreignField: "_id",
          as: "sku",
        },
      },
      {
        $unwind: {
          path: "$sku",
          preserveNullAndEmptyArrays: false,
        },
      },
      {
        $match: {
          "sku.isDeleted": false,
          "sku.isActive": true,
        },
      },
      {
        $addFields: {
          availableQuantity: {
            $max: [{ $subtract: ["$stockQuantity", "$reservedQuantity"] }, 0],
          },
        },
      },
      {
        $project: {
          skuId: "$sku._id",
          skuCode: "$sku.skuCode",
          displayName: "$sku.displayName",
          variantType: "$sku.variantType",
          stockQuantity: 1,
          reservedQuantity: 1,
          availableQuantity: 1,
          lowStockThreshold: 1,
          isLowStock: {
            $and: [
              { $gt: ["$availableQuantity", 0] },
              { $lte: ["$availableQuantity", "$lowStockThreshold"] },
            ],
          },
          isOutOfStock: { $lte: ["$availableQuantity", 0] },
        },
      },
      { $sort: { skuCode: 1 } },
    ]);

    return {
      locationId: location._id as mongoose.Types.ObjectId,
      locationName: location.name,
      locationType: location.type,
      totalSkus: records.length,
      items: records,
    };
  }

  // LOW STOCK LIST

  /**
   * getLowStockItems()
   *
   * Returns all inventory records where available <= threshold.
   * Returned by GET /api/inventory/low-stock
   */
  async getLowStockItems(): Promise<LowStockAlert[]> {
    const records = await Inventory.aggregate([
      { $match: { isDeleted: false } },
      {
        $addFields: {
          availableQuantity: {
            $max: [{ $subtract: ["$stockQuantity", "$reservedQuantity"] }, 0],
          },
        },
      },
      {
        $match: {
          $expr: { $lte: ["$availableQuantity", "$lowStockThreshold"] },
        },
      },
      {
        $lookup: {
          from: "inventory_skus",
          localField: "skuId",
          foreignField: "_id",
          as: "sku",
        },
      },
      {
        $lookup: {
          from: "inventory_locations",
          localField: "locationId",
          foreignField: "_id",
          as: "location",
        },
      },
      {
        $unwind: { path: "$sku", preserveNullAndEmptyArrays: false },
      },
      {
        $unwind: { path: "$location", preserveNullAndEmptyArrays: false },
      },
      {
        $match: {
          "sku.isActive": true,
          "sku.isDeleted": false,
          "location.isActive": true,
          "location.isDeleted": false,
        },
      },
      {
        $project: {
          _id: 0,
          skuId: "$sku._id",
          skuCode: "$sku.skuCode",
          displayName: "$sku.displayName",
          variantType: "$sku.variantType",
          locationId: "$location._id",
          locationName: "$location.name",
          locationType: "$location.type",
          availableQuantity: 1,
          lowStockThreshold: 1,
          deficit: { $subtract: ["$lowStockThreshold", "$availableQuantity"] },
        },
      },
      { $sort: { deficit: -1 } },   // worst deficit first
    ]);

    return records as LowStockAlert[];
  }

  // FILTERED INVENTORY LIST

  /**
   * getInventoryList()
   *
   * Paginated, filterable inventory list.
   * Supports filtering by locationId, skuId, variantType, isLowStock, isOutOfStock.
   */
  async getInventoryList(
    filters: InventoryFilterDto
  ): Promise<PaginatedResponse<LocationStockView & { skuCode: string; displayName: string; variantType: ProductVariant }>> {
    const {
      locationId,
      skuId,
      variantType,
      isLowStock,
      isOutOfStock,
      page = 1,
      limit = 20,
    } = filters;

    const matchStage: Record<string, any> = { isDeleted: false };
    if (locationId) matchStage.locationId = new mongoose.Types.ObjectId(locationId);
    if (skuId) matchStage.skuId = new mongoose.Types.ObjectId(skuId);

    const pipeline: PipelineStage[] = [
      { $match: matchStage },

      // Join SKU
      {
        $lookup: {
          from: "inventory_skus",
          localField: "skuId",
          foreignField: "_id",
          as: "sku",
        },
      },
      { $unwind: { path: "$sku", preserveNullAndEmptyArrays: false } },
      {
        $match: {
          "sku.isActive": true,
          "sku.isDeleted": false,
          ...(variantType ? { "sku.variantType": variantType } : {}),
        },
      },

      // Join Location
      {
        $lookup: {
          from: "inventory_locations",
          localField: "locationId",
          foreignField: "_id",
          as: "location",
        },
      },
      { $unwind: { path: "$location", preserveNullAndEmptyArrays: false } },
      {
        $match: {
          "location.isActive": true,
          "location.isDeleted": false,
        },
      },

      // Compute available + status flags
      {
        $addFields: {
          availableQuantity: {
            $max: [{ $subtract: ["$stockQuantity", "$reservedQuantity"] }, 0],
          },
        },
      },
      {
        $addFields: {
          isLowStock: {
            $and: [
              { $gt: ["$availableQuantity", 0] },
              { $lte: ["$availableQuantity", "$lowStockThreshold"] },
            ],
          },
          isOutOfStock: { $lte: ["$availableQuantity", 0] },
        },
      },

      // Apply status filters AFTER computing flags
      ...(isLowStock !== undefined
        ? [{ $match: { isLowStock } }]
        : []),
      ...(isOutOfStock !== undefined
        ? [{ $match: { isOutOfStock } }]
        : []),

      {
        $project: {
          _id: 0,
          skuId: "$sku._id",
          skuCode: "$sku.skuCode",
          displayName: "$sku.displayName",
          variantType: "$sku.variantType",
          locationId: "$location._id",
          locationName: "$location.name",
          locationType: "$location.type",
          stockQuantity: 1,
          reservedQuantity: 1,
          availableQuantity: 1,
          lowStockThreshold: 1,
          isLowStock: 1,
          isOutOfStock: 1,
        },
      },
    ];

    // Count total before pagination
    const countPipeline = [...pipeline, { $count: "total" }];
    const countResult = await Inventory.aggregate(countPipeline);
    const total = countResult[0]?.total ?? 0;

    // Apply pagination
    pipeline.push({ $sort: { "sku.skuCode": 1 } });
    pipeline.push({ $skip: (page - 1) * limit });
    pipeline.push({ $limit: limit });

    const data = await Inventory.aggregate(pipeline);
    const totalPages = Math.ceil(total / limit);

    return {
      data,
      pagination: {
        total,
        page,
        limit,
        pages: totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1,
      },
    };
  }

  // MOVEMENT HISTORY

  /**
   * getMovementHistory()
   *
   * Paginated movement log with filters.
   * Supports filtering by skuId, locationId, movementType, status,
   * orderId, subscriptionId, performedBy, dateFrom/dateTo.
   */
  async getMovementHistory(
    filters: MovementFilterDto
  ): Promise<PaginatedResponse<any>> {
    const {
      skuId,
      fromLocationId,
      toLocationId,
      locationId,
      movementType,
      status,
      orderId,
      subscriptionId,
      performedBy,
      dateFrom,
      dateTo,
    } = filters;

    // Ensure page and limit are numbers
    const page = Number(filters.page) || 1;
    const limit = Number(filters.limit) || 20;

    const match: Record<string, any> = {};

    // Cast IDs only if they exist
    if (skuId) match.skuId = new mongoose.Types.ObjectId(skuId);
    if (movementType) match.movementType = movementType;
    if (status) match.status = status;
    if (orderId) match.orderId = new mongoose.Types.ObjectId(orderId);
    if (subscriptionId) match.subscriptionId = new mongoose.Types.ObjectId(subscriptionId);
    if (performedBy) match.performedBy = new mongoose.Types.ObjectId(performedBy);

    // locationId matches either from or to
    if (locationId) {
      const locId = new mongoose.Types.ObjectId(locationId);
      match.$or = [{ fromLocationId: locId }, { toLocationId: locId }];
    } else {
      if (fromLocationId) match.fromLocationId = new mongoose.Types.ObjectId(fromLocationId);
      if (toLocationId) match.toLocationId = new mongoose.Types.ObjectId(toLocationId);
    }

    // Date range with safety check
    if (dateFrom || dateTo) {
      match.createdAt = {};
      if (dateFrom) {
        const d = new Date(dateFrom);
        if (!isNaN(d.getTime())) match.createdAt.$gte = d;
      }
      if (dateTo) {
        const d = new Date(dateTo);
        if (!isNaN(d.getTime())) match.createdAt.$lte = d;
      }
      // Cleanup if dates were invalid
      if (Object.keys(match.createdAt).length === 0) delete match.createdAt;
    }

    const total = await InventoryMovements.countDocuments(match);
    const totalPages = Math.ceil(total / limit);

    const data = await InventoryMovements.find(match)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .populate("skuId", "skuCode displayName variantType")
      .populate("fromLocationId", "name type")
      .populate("toLocationId", "name type")
      .populate("performedBy", "name email")
      .lean();

    return {
      data,
      pagination: {
        total,
        page,
        limit,
        pages: totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1,
      },
    };
  }

  // THRESHOLD UPDATE
  // The only write operation allowed in this service.
  // Does not create a movement record — threshold changes are config,
  // not stock events.

  /**
   * updateThreshold()
   *
   * Updates the low_stock_threshold for one SKU at one Location.
   * PATCH /api/inventory/:skuId/:locationId/threshold
   */
  async updateThreshold(
    skuId: string,
    locationId: string,
    dto: UpdateThresholdDto,
    updatedBy: string
  ): Promise<{ skuId: string; locationId: string; lowStockThreshold: number }> {
    const updated = await Inventory.findOneAndUpdate(
      {
        skuId: new mongoose.Types.ObjectId(skuId),
        locationId: new mongoose.Types.ObjectId(locationId),
        isDeleted: false,
      },
      {
        $set: {
          lowStockThreshold: dto.lowStockThreshold,
          updatedBy: new mongoose.Types.ObjectId(updatedBy),
        },
      },
      { new: true, select: "skuId locationId lowStockThreshold" }
    ).lean();

    if (!updated) {
      throw new Error(
        `No inventory record found for SKU ${skuId} at location ${locationId}`
      );
    }

    return {
      skuId,
      locationId,
      lowStockThreshold: updated.lowStockThreshold,
    };
  }

  // SINGLE MOVEMENT

  /**
   * getMovementById()
   *
   * Returns a single movement record with all references populated.
   */
  async getMovementById(movementId: string): Promise<any> {
    const movement = await InventoryMovements.findById(movementId)
      .populate("skuId", "skuCode displayName variantType unit")
      .populate("fromLocationId", "name type address")
      .populate("toLocationId", "name type address")
      .populate("performedBy", "name email")
      .lean();

    if (!movement) throw new Error(`Movement not found: ${movementId}`);

    return movement;
  }
}

// EXPORT SINGLETON

export const inventoryService = new InventoryService();