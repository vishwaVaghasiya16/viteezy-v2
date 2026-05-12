import { MovementType, LocationType } from "@/models/enums";
import { AllowedRoute } from "@/types/inventory.types";

export const MovementLocationRules: Partial<Record<MovementType, AllowedRoute>> = {
  [MovementType.PURCHASE]: {
    allowedSources: [LocationType.MANUFACTURER],
    allowedDestinations: [LocationType.WAREHOUSE, LocationType.FULFILLMENT_CENTER, LocationType.PACKAGING_PARTNER],
  },
  [MovementType.TRANSFER]: {
    allowedSources: [LocationType.WAREHOUSE],
    allowedDestinations: [LocationType.FULFILLMENT_CENTER, LocationType.PACKAGING_PARTNER],
  },
  [MovementType.SALE]: {
    allowedSources: [LocationType.FULFILLMENT_CENTER, LocationType.PACKAGING_PARTNER],
    allowedDestinations: [], // Customer ID handled separately
  },
  [MovementType.RETURN]: {
    allowedSources: [], // Customer ID handled separately
    allowedDestinations: [LocationType.WAREHOUSE],
  },
  [MovementType.RESERVATION]: {
    allowedSources: [LocationType.FULFILLMENT_CENTER, LocationType.PACKAGING_PARTNER],
    allowedDestinations: [LocationType.FULFILLMENT_CENTER, LocationType.PACKAGING_PARTNER],
    requiresSameLocation: true,
  }
};
