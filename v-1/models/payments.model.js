import mongoose from "mongoose";

const PaymentsSchema = new mongoose.Schema(
  {
    "id": {
      type: Number,
      required: true,
    },
    "amount": {
      type: Number,
      required: true,
    },
    "mollie_payment_id": {
      type: String,
      required: false,
    },
    "retried_mollie_payment_id": {
      type: String,
      required: false,
    },
    "payment_plan_id": {
      type: Number,
      required: true,
    },
    "creation_date": {
      type: Date,
      required: true,
    },
    "payment_date": {
      type: Date,
      required: false,
    },
    "last_modified": {
      type: Date,
      required: true,
    },
    "status": {
      type: String,
      required: true,
    },
    "reason": {
      type: String,
      required: false,
    },
    "sequence_type": {
      type: String,
      required: false,
    },
  },
  {
    timestamps: false,
    versionKey: false,
    collection: "payments"
  }
);

const Payments = mongoose.model("Payments", PaymentsSchema);
export default Payments;
