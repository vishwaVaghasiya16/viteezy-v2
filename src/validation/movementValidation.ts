import Joi from "joi";
import {
  MovementType,
  MovementStatus,
  InventoryAdjustmentReason,
  AdjustmentDirection,
} from "@/models/enums";
import {
  requiresFromLocation,
  requiresToLocation,
  requiresOrderId,
  requiresAdjustmentReason,
} from "../types/inventory.types";

// REUSABLE

const mongoId = Joi.string()
  .pattern(/^[a-fA-F0-9]{24}$/)
  .messages({
    "string.pattern.base": "Must be a valid MongoDB ObjectId",
  });

// CREATE MOVEMENT
// Validation is done in two passes:
//   Pass 1 — base schema validates field types and formats
//   Pass 2 — custom() enforces per-movementType business rules
//            using the same type guard helpers used by the service layer

export const createMovementSchema = Joi.object({
  movementType: Joi.string()
    .valid(...Object.values(MovementType))
    .required()
    .messages({
      "any.only": `movementType must be one of: ${Object.values(MovementType).join(", ")}`,
      "any.required": "movementType is required",
    }),

  skuId: mongoId.required().messages({
    "string.empty": "skuId is required",
    "any.required": "skuId is required",
  }),

  fromLocationId: mongoId.optional().allow(null, "").messages({
    "string.pattern.base": "fromLocationId must be a valid MongoDB ObjectId",
  }),

  toLocationId: mongoId.optional().allow(null, "").messages({
    "string.pattern.base": "toLocationId must be a valid MongoDB ObjectId",
  }),

  quantity: Joi.number()
    .integer()
    .min(1)
    .required()
    .messages({
      "number.base": "quantity must be a number",
      "number.integer": "quantity must be a whole number",
      "number.min": "quantity must be at least 1",
      "any.required": "quantity is required",
    }),

  // Order / subscription linkage
  orderId: mongoId.optional().allow(null, "").messages({
    "string.pattern.base": "orderId must be a valid MongoDB ObjectId",
  }),
  subscriptionId: mongoId.optional().allow(null, "").messages({
    "string.pattern.base": "subscriptionId must be a valid MongoDB ObjectId",
  }),
  referenceCode: Joi.string().trim().max(100).optional().allow(null, ""),

  // Adjustment specific
  adjustmentDirection: Joi.string()
    .valid(...Object.values(AdjustmentDirection))
    .optional()
    .allow(null)
    .messages({
      "any.only": `adjustmentDirection must be one of: ${Object.values(AdjustmentDirection).join(", ")}`,
    }),
  adjustmentReason: Joi.string()
    .valid(...Object.values(InventoryAdjustmentReason))
    .optional()
    .allow(null)
    .messages({
      "any.only": `adjustmentReason must be one of: ${Object.values(InventoryAdjustmentReason).join(", ")}`,
    }),
  adjustmentNote: Joi.string().trim().max(500).optional().allow(null, ""),
})
  .custom((value, helpers) => {
    const { movementType, fromLocationId, toLocationId, orderId, subscriptionId, adjustmentReason } = value;

    // ── fromLocationId required check ────────────────────────────────────
    if (requiresFromLocation(movementType) && !fromLocationId) {
      return helpers.error("any.invalid", {
        message: `fromLocationId is required for ${movementType} movements`,
      });
    }

    // ── toLocationId required check ──────────────────────────────────────
    if (requiresToLocation(movementType) && !toLocationId) {
      return helpers.error("any.invalid", {
        message: `toLocationId is required for ${movementType} movements`,
      });
    }

    // ── Transfer: both locations must differ ─────────────────────────────
    if (
      movementType === MovementType.TRANSFER &&
      fromLocationId &&
      toLocationId &&
      fromLocationId === toLocationId
    ) {
      return helpers.error("any.invalid", {
        message: "fromLocationId and toLocationId must be different for Transfer movements",
      });
    }

    // ── orderId/subscriptionId linkage check ────────────────────────────
    if (requiresOrderId(movementType)) {
      if (!orderId && !subscriptionId) {
        return helpers.error("any.invalid", {
          message: `Either orderId or subscriptionId is required for ${movementType} movements`,
        });
      }
    }

    // ── adjustmentReason required check ─────────────────────────────────
    if (requiresAdjustmentReason(movementType) && !adjustmentReason) {
      return helpers.error("any.invalid", {
        message: "adjustmentReason is required for Adjustment movements",
      });
    }

    // ── adjustmentDirection required check ─────────────────────────────
    if (movementType === MovementType.ADJUSTMENT && !value.adjustmentDirection) {
      return helpers.error("any.invalid", {
        message: "adjustmentDirection is required for Adjustment movements",
      });
    }

    // ── Adjustment: must specify a location ────────────────────────────
    if (movementType === MovementType.ADJUSTMENT) {
      const hasFrom = Boolean(fromLocationId);
      const hasTo = Boolean(toLocationId);
      if (!hasFrom && !hasTo) {
        return helpers.error("any.invalid", {
          message: "Adjustment movements must specify either fromLocationId or toLocationId",
        });
      }
    }

    return value;
  })
  .messages({
    "any.invalid": "{{#message}}",
  });

// LIST / FILTER MOVEMENTS

export const movementFilterSchema = Joi.object({
  skuId: mongoId.optional(),
  fromLocationId: mongoId.optional(),
  toLocationId: mongoId.optional(),
  locationId: mongoId.optional(),         // matches either from or to
  movementType: Joi.string()
    .valid(...Object.values(MovementType))
    .optional()
    .messages({
      "any.only": `movementType must be one of: ${Object.values(MovementType).join(", ")}`,
    }),
  status: Joi.string()
    .valid(...Object.values(MovementStatus))
    .optional()
    .messages({
      "any.only": `status must be one of: ${Object.values(MovementStatus).join(", ")}`,
    }),
  orderId: mongoId.optional(),
  subscriptionId: mongoId.optional(),
  performedBy: mongoId.optional(),
  dateFrom: Joi.date().iso().optional().messages({
    "date.format": "dateFrom must be a valid ISO 8601 date",
  }),
  dateTo: Joi.date()
    .iso()
    .min(Joi.ref("dateFrom"))
    .optional()
    .messages({
      "date.format": "dateTo must be a valid ISO 8601 date",
      "date.min": "dateTo must be after dateFrom",
    }),
  page: Joi.number().integer().min(1).default(1).optional(),
  limit: Joi.number().integer().min(1).max(100).default(20).optional(),
});

// PARAM VALIDATORS

export const movementIdParamSchema = Joi.object({
  movementId: mongoId.required().messages({
    "any.required": "movementId param is required",
  }),
});