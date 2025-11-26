import mongoose from "mongoose";

const CouponsSchema = new mongoose.Schema(
  {
    "id": {
      type: Number,
      required: true,
    },
    "coupon_code": {
      type: String,
      required: true,
    },
    "start_date": {
      type: Date,
      required: true,
    },
    "end_date": {
      type: Date,
      required: true,
    },
    "amount": {
      type: Number,
      required: true,
    },
    "minimum_amount": {
      type: Number,
      required: true,
    },
    "maximum_amount": {
      type: Number,
      required: true,
    },
    "percentage": {
      type: Number,
      required: true,
    },
    "max_uses": {
      type: Number,
      required: true,
      default: 0,
    },
    "used": {
      type: Number,
      required: true,
      default: 0,
    },
    "recurring_months": {
      type: Number,
      required: false,
    },
    "recurring_terms": {
      type: String,
      required: false,
    },
    "is_recurring": {
      type: Boolean,
      required: false,
      default: false,
    },
    "ingredient_id": {
      type: Number,
      required: false,
    },
    "creation_date": {
      type: Date,
      required: true,
    },
    "is_active": {
      type: Boolean,
      required: false,
    },
  },
  {
    timestamps: false,
    versionKey: false,
    collection: "coupons"
  }
);

const Coupons = mongoose.model("Coupons", CouponsSchema);
export default Coupons;
