import mongoose from "mongoose";

const CouponsDiscountSchema = new mongoose.Schema(
  {
    "id": {
      type: Number,
      required: true,
    },
    "coupon_id": {
      type: Number,
      required: true,
    },
    "payment_plan_id": {
      type: Number,
      required: true,
    },
    "month": {
      type: Number,
      required: true,
    },
    "amount": {
      type: Number,
      required: true,
    },
    "status": {
      type: String,
      required: true,
    },
    "creation_timestamp": {
      type: Date,
      required: true,
    },
    "modification_timestamp": {
      type: Date,
      required: true,
    },
  },
  {
    timestamps: false,
    versionKey: false,
    collection: "coupons_discount"
  }
);

const CouponsDiscount = mongoose.model("CouponsDiscount", CouponsDiscountSchema);
export default CouponsDiscount;
