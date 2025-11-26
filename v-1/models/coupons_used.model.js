import mongoose from "mongoose";

const CouponsUsedSchema = new mongoose.Schema(
  {
    "id": {
      type: Number,
      required: true,
    },
    "coupon_id": {
      type: Number,
      required: true,
    },
    "customer_id": {
      type: Number,
      required: true,
    },
    "payment_plan_id": {
      type: Number,
      required: true,
    },
    "status": {
      type: String,
      required: true,
      default: "PAYMENT_CREATED",
    },
  },
  {
    timestamps: false,
    versionKey: false,
    collection: "coupons_used"
  }
);

const CouponsUsed = mongoose.model("CouponsUsed", CouponsUsedSchema);
export default CouponsUsed;
