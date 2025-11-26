import mongoose from "mongoose";

const PaymentPlansSchema = new mongoose.Schema(
  {
    "id": {
      type: Number,
      required: true,
    },
    "first_amount": {
      type: Number,
      required: true,
    },
    "recurring_amount": {
      type: Number,
      required: true,
    },
    "recurring_months": {
      type: Number,
      required: true,
    },
    "customer_id": {
      type: Number,
      required: true,
    },
    "blend_id": {
      type: Number,
      required: true,
    },
    "external_reference": {
      type: String,
      required: true,
    },
    "creation_date": {
      type: Date,
      required: true,
    },
    "last_modified": {
      type: Date,
      required: true,
    },
    "status": {
      type: String,
      required: true,
    },
    "payment_date": {
      type: Date,
      required: true,
    },
    "next_payment_date": {
      type: Date,
      required: false,
    },
    "stop_reason": {
      type: String,
      required: false,
    },
    "delivery_date": {
      type: Date,
      required: false,
    },
    "next_delivery_date": {
      type: Date,
      required: false,
    },
    "payment_method": {
      type: String,
      required: false,
    },
  },
  {
    timestamps: false,
    versionKey: false,
    collection: "payment_plans"
  }
);

const PaymentPlans = mongoose.model("PaymentPlans", PaymentPlansSchema);
export default PaymentPlans;
