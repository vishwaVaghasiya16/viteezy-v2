import mongoose from "mongoose";
import { Addresses } from "@/models/core/addresses.model";
import { Locations } from "@/models/inventory/location.model";
import { LocationType } from "@/models/enums";
import { AppError } from "@/utils/AppError";

type MiniLoc = {
  _id: mongoose.Types.ObjectId;
  name: string;
  type: LocationType;
};

function addressDocToEmbedded(addr: Record<string, any>) {
  const streetParts = [
    addr.streetName,
    addr.houseNumber,
    addr.houseNumberAddition,
  ].filter(Boolean);
  const street = streetParts.join(" ").trim() || undefined;

  return {
    street,
    postalCode: addr.postalCode || undefined,
    city: addr.city ?? undefined,
    country: addr.country ?? undefined,
    countryCode: undefined as string | undefined,
  };
}

/**
 * Returns a CUSTOMER inventory location keyed to order shipping (`addresses._id`).
 * Ensures SALE / RETURN / release movements can reference shipping as from/to endpoints.
 */
export async function ensureCustomerLocationForShippingAddressId(
  shippingAddressId: mongoose.Types.ObjectId | string,
  opts?: { session?: mongoose.ClientSession | null }
): Promise<MiniLoc> {
  const id =
    typeof shippingAddressId === "string"
      ? new mongoose.Types.ObjectId(shippingAddressId)
      : shippingAddressId;

  let existingQuery = Locations.findOne({
    linkedAddressId: id,
    isDeleted: false,
    isActive: true,
  });
  if (opts?.session) {
    existingQuery = existingQuery.session(opts.session);
  }

  let existing = await existingQuery.lean();
  if (existing) {
    return {
      _id: existing._id as mongoose.Types.ObjectId,
      name: existing.name,
      type: existing.type as LocationType,
    };
  }

  let addressQuery = Addresses.findOne({
    _id: id,
    isDeleted: { $ne: true },
  });
  if (opts?.session) {
    addressQuery = addressQuery.session(opts.session);
  }

  const addressDoc = await addressQuery.lean();

  if (!addressDoc) {
    throw new AppError(`Shipping address not found: ${id}`, 404);
  }

  const name = `ship-${id.toHexString()}`;
  const inserted = await Locations.create(
    [
      {
        name,
        type: LocationType.CUSTOMER,
        linkedAddressId: id,
        address: addressDocToEmbedded(addressDoc),
        isActive: true,
        isDeleted: false,
      },
    ],
    opts?.session ? { session: opts.session } : {}
  );

  const loc = Array.isArray(inserted) ? inserted[0] : inserted;
  return {
    _id: loc._id as mongoose.Types.ObjectId,
    name: loc.name,
    type: loc.type as LocationType,
  };
}
