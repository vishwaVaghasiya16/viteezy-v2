import mongoose from "mongoose";

const OrdersSchema = new mongoose.Schema(
  {
    "id": {
      type: Number,
      required: true,
    },
    "external_reference": {
      type: String,
      required: true,
    },
    "order_number": {
      type: String,
      required: true,
    },
    "payment_id": {
      type: Number,
      required: true,
    },
    "sequence_type": {
      type: String,
      required: false,
    },
    "payment_plan_id": {
      type: Number,
      required: true,
    },
    "blend_id": {
      type: Number,
      required: true,
    },
    "customer_id": {
      type: Number,
      required: true,
    },
    "recurring_months": {
      type: Number,
      required: true,
    },
    "first_name": {
      type: String,
      required: false,
    },
    "last_name": {
      type: String,
      required: false,
    },
    "phone_number": {
      type: String,
      required: false,
    },
    "street": {
      type: String,
      required: false,
    },
    "house_number": {
      type: String,
      required: false,
    },
    "house_number_addition": {
      type: String,
      required: false,
    },
    "postcode": {
      type: String,
      required: false,
    },
    "city": {
      type: String,
      required: false,
    },
    "country": {
      type: String,
      required: false,
    },
    "email": {
      type: String,
      required: false,
    },
    "referral_code": {
      type: String,
      required: false,
    },
    "tracktrace": {
      type: String,
      required: false,
    },
    "pharmacist_order_number": {
      type: String,
      required: false,
    },
    "status": {
      type: String,
      required: true,
    },
    "created": {
      type: Date,
      required: true,
    },
    "shipped": {
      type: Date,
      required: false,
    },
    "last_modified": {
      type: Date,
      required: true,
    },
  },
  {
    timestamps: false,
    versionKey: false,
    collection: "orders"
  }
);

const Orders = mongoose.model("Orders", OrdersSchema);
export default Orders;
