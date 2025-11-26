import mongoose from "mongoose";

const PharmacistOrdersSchema = new mongoose.Schema(
  {
    "id": {
      type: Number,
      required: true,
    },
    "batch_name": {
      type: String,
      required: true,
    },
    "batch_number": {
      type: Number,
      required: true,
    },
    "order_number": {
      type: String,
      required: true,
    },
    "file_name": {
      type: String,
      required: true,
    },
    "status": {
      type: String,
      required: true,
    },
    "creation_timestamp": {
      type: Date,
      required: false,
    },
    "modification_timestamp": {
      type: Date,
      required: false,
    },
  },
  {
    timestamps: false,
    versionKey: false,
    collection: "pharmacist_orders"
  }
);

const PharmacistOrders = mongoose.model("PharmacistOrders", PharmacistOrdersSchema);
export default PharmacistOrders;
